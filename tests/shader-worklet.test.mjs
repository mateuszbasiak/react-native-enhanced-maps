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
    frames = [];
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
            setViewport() {},
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
  assert.equal(frames.length, 2);
});
