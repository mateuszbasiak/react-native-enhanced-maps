import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
test('worklet updates shared simulation once per atlas, retains it across tile changes and accumulates backpressure time', async () => {
  const url = new URL('../packages/maps/lib/shaderWorklet.js', import.meta.url);
  const code = readFileSync(url, 'utf8')
    .replace(
      /import \{ installWebGPU \} from 'react-native-webgpu';/,
      'const installWebGPU=()=>{};',
    )
    .replace(
      /from '(\.\/[^']+)'/g,
      (_, p) => `from '${new URL(p + '.js', url).href}'`,
    );
  const { runShaderFrames } = await import(
    `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`
  );
  const previousRAF = globalThis.requestAnimationFrame,
    previousNow = Date.now;
  let now = 0,
    published = 0,
    acquired = 0,
    compute = 0,
    draws = 0,
    submissions = 0;
  const builtin = {},
    user = {},
    simulationGroup = { storage: 'persistent' };
  const clocks = [],
    frames = [],
    viewports = [];
  const control = {
    stopped: false,
    active: true,
    paused: false,
    uniforms: (frame) => {
      frames.push(frame);
      return [1];
    },
  };
  const outputs = [0, 1].map(() => ({
    memory: {
      beginAccess() {},
      endAccess() {
        return { fences: [] };
      },
    },
    texture: {
      createView() {
        return {};
      },
    },
  }));
  const device = {
    queue: {
      writeBuffer(buffer, _offset, data) {
        if (buffer === builtin) clocks.push([...data.slice(0, 12)]);
      },
      submit() {
        submissions++;
      },
      onSubmittedWorkDone() {
        return Promise.resolve();
      },
    },
    createCommandEncoder() {
      return {
        beginComputePass() {
          return {
            setPipeline() {},
            setBindGroup(_slot, group) {
              assert.equal(group, simulationGroup);
            },
            dispatchWorkgroups() {
              compute++;
            },
            end() {},
          };
        },
        beginRenderPass() {
          return {
            setPipeline() {},
            setViewport(...args) {
              viewports.push(args);
            },
            setScissorRect() {},
            setBindGroup() {},
            draw() {
              draws++;
            },
            end() {},
          };
        },
        finish() {
          return {};
        },
      };
    },
  };
  try {
    Date.now = () => now;
    globalThis.requestAnimationFrame = (cb) => {
      now += 20;
      setImmediate(() => cb(now));
      return 1;
    };
    await runShaderFrames({
      device,
      atlasSize: 1024,
      outputs,
      builtin,
      user,
      pipeline: {},
      group: {},
      compute: { pipeline: {}, group: simulationGroup, workgroups: [1] },
      vertexCount: 6,
      instanceCount: 10,
      control: { getBlocking: () => control },
      handle: {
        view() {
          return published
            ? [0.8, 0.4, 0.82, 0.42, 6]
            : [0.49, 0.49, 0.51, 0.51, 6];
        },
        acquire() {
          return ++acquired === 1 ? -1 : published;
        },
        publish(_slot, tiles) {
          assert.ok(tiles.length > 3 && tiles.length <= 48);
          published++;
          if (published === 2) control.stopped = true;
          return true;
        },
        stats() {
          return { error: '' };
        },
      },
    });
  } finally {
    Date.now = previousNow;
    globalThis.requestAnimationFrame = previousRAF;
  }
  assert.equal(published, 2);
  assert.equal(compute, 2);
  assert.equal(submissions, 2);
  assert.ok(draws > compute);
  assert.ok(Math.abs(clocks[0][1] - 0.04) < 1e-7);
  assert.ok(Math.abs(clocks[1][0] - 0.06) < 1e-7);
  assert.notEqual(clocks[0][4], clocks[1][4]);
  assert.ok(viewports.length > 0);
  assert.ok(viewports.every((v) => v[2] === 256 && v[3] === 256));
  assert.ok(viewports.every((v) => v[0] + v[2] <= 1024 && v[1] + v[3] <= 1024));
  assert.equal(frames.length, 2);
  assert.ok(
    frames.every((frame) => frame.width === 252 && frame.height === 252),
  );
  assert.deepEqual(clocks[0].slice(2, 4), [252, 252]);
});

test('zoom hides stale output, freezes simulation and applies grid replacement on reentry', async () => {
  const url = new URL('../packages/maps/lib/shaderWorklet.js', import.meta.url);
  const code = readFileSync(url, 'utf8')
    .replace(
      /import \{ installWebGPU \} from 'react-native-webgpu';/,
      'const installWebGPU=()=>{};',
    )
    .replace(
      /from '(\.\/[^']+)'/g,
      (_, p) => `from '${new URL(p + '.js', url).href}'`,
    );
  const { runShaderFrames } = await import(
    `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`
  );
  const { packShaderGrid } =
    await import('../packages/maps/lib/shaderContract.js');
  const grid = (value) =>
    packShaderGrid({
      width: 1,
      height: 1,
      bounds: [-10, -10, 10, 10],
      channels: 1,
      projection: 'mercator',
      units: 'K',
      interpolation: 'nearest',
      values: [value],
    });
  const control = {
    stopped: false,
    active: true,
    paused: false,
    minZoom: 5,
    maxZoom: 10,
    grid: grid(7),
    gridVersion: 1,
    uniforms: (f) => {
      frames.push(f);
      return [];
    },
  };
  const frames = [],
    writes = [],
    groups = [],
    destroyed = [],
    passes = [];
  let tick = 0,
    published = 0,
    dispatches = 0,
    gridReads = 0;
  const previousRAF = globalThis.requestAnimationFrame,
    previousNow = Date.now;
  const builtin = {},
    user = {},
    storage = {},
    metadata = {};
  const device = {
    createBuffer(options) {
      const buffer = {
        options,
        destroy() {
          destroyed.push(buffer);
        },
      };
      return buffer;
    },
    createBindGroup(options) {
      groups.push(options);
      return options;
    },
    queue: {
      writeBuffer(buffer, offset, data) {
        writes.push({ buffer, values: [...data] });
      },
      submit() {},
      onSubmittedWorkDone: async () => {},
    },
    createCommandEncoder() {
      return {
        beginComputePass() {
          return {
            setPipeline() {},
            setBindGroup() {},
            dispatchWorkgroups() {
              dispatches++;
            },
            end() {},
          };
        },
        beginRenderPass() {
          const pass = { draws: 0 };
          passes.push(pass);
          return {
            setPipeline() {},
            setViewport() {},
            setScissorRect() {},
            setBindGroup() {},
            draw() {
              pass.draws++;
            },
            end() {},
          };
        },
        finish() {
          return {};
        },
      };
    },
  };
  try {
    Date.now = () => tick * 20;
    globalThis.requestAnimationFrame = (cb) => {
      tick++;
      if (tick === 3) {
        control.grid = grid(9);
        control.gridVersion++;
      }
      if (tick > 6) control.stopped = true;
      setImmediate(() => cb(tick * 20));
      return tick;
    };
    await runShaderFrames({
      device,
      atlasSize: 1024,
      builtin,
      user,
      pipeline: {},
      group: {},
      gridResources: {
        data: {
          getBlocking: () => {
            gridReads++;
            return control.grid;
          },
        },
        storageUsage: 136,
        renderLayout: {},
        computeLayout: {},
        storage,
        metadata,
      },
      compute: { pipeline: {}, group: {}, workgroups: [1] },
      vertexCount: 3,
      instanceCount: 1,
      outputs: [
        {
          texture: { createView: () => ({}) },
          memory: {
            beginAccess() {},
            endAccess: () => ({ fences: [] }),
          },
        },
      ],
      control: { getBlocking: () => control },
      handle: {
        view: () => [
          0.49,
          0.49,
          0.51,
          0.51,
          tick === 1 ? 6.25 : tick < 5 ? 10 : 5,
        ],
        acquire: () => 0,
        publish() {
          published++;
          return true;
        },
        stats: () => ({ error: '' }),
      },
    });
  } finally {
    globalThis.requestAnimationFrame = previousRAF;
    Date.now = previousNow;
  }
  assert.equal(published, 4); // first visible, clear once, then two visible frames
  assert.deepEqual(
    passes.map((p) => p.draws > 0),
    [true, false, true, true],
  );
  assert.equal(dispatches, 3);
  assert.deepEqual(
    frames.map((f) => f.zoom),
    [6.25, 5, 5],
  );
  assert.ok(frames.every((f) => Math.abs(f.delta - 0.02) < 1e-6));
  const gridUploads = writes.filter(
    (w) => w.buffer !== builtin && w.buffer !== user && w.buffer !== metadata,
  );
  assert.deepEqual(
    gridUploads.map((w) => w.values[0]),
    [7, 9],
  );
  assert.equal(gridReads, 2); // no grid reads/copies on ordinary frames
  assert.equal(groups.length, 4); // render + compute rebuilt for each grid only
  assert.ok(
    groups.every(
      (g) => g.entries.find((e) => e.binding === 2).resource.buffer === storage,
    ),
  );
  assert.equal(destroyed.length, 2); // replaced and final grid buffers
  assert.equal(writes.find((w) => w.buffer === builtin).values[12], 6.25);
});
