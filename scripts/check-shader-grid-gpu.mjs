// Optional numerical WebGPU check against a local Chrome CDP endpoint.
// Start Chrome with --headless --enable-unsafe-webgpu --use-angle=swiftshader
// --remote-debugging-port=9227 --user-data-dir=/tmp/shader-grid-chrome
// Build first, then run: node scripts/check-shader-grid-gpu.mjs
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import {
  shaderPrelude,
  shaderTileInterior,
  shaderGridPrelude,
  defaultShaderVertex,
  packShaderGrid,
} from '../packages/maps/lib/shaderContract.js';
const example = ts.transpileModule(
  readFileSync('example/gpu/webgpuShader.ts', 'utf8'),
  {
    compilerOptions: { module: ts.ModuleKind.ES2022 },
  },
).outputText;
const shaders = await import(
  `data:text/javascript;base64,${Buffer.from(example).toString('base64')}`
);
const server = createServer((_req, res) =>
  res.end('<!doctype html><title>Shader grid GPU check</title>'),
);
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
let socket;
try {
  const tabs = await (await fetch('http://127.0.0.1:9227/json/list')).json();
  const target = tabs.find((tab) => tab.type === 'page');
  assert.ok(target, 'A Chrome page target is required');
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.onopen = resolve;
    socket.onerror = reject;
  });
  let sequence = 0;
  const pending = new Map();
  socket.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (message.id) {
      const { resolve, reject } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) reject(new Error(JSON.stringify(message.error)));
      else resolve(message.result);
    }
  };
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = ++sequence;
      pending.set(id, { resolve, reject });
      socket.send(JSON.stringify({ id, method, params }));
    });
  await send('Page.navigate', {
    url: `http://127.0.0.1:${server.address().port}`,
  });
  // Wait for the secure localhost context rather than relying on a navigation delay.
  for (let attempt = 0; attempt < 100; attempt++) {
    const state = await send('Runtime.evaluate', {
      expression: 'location.href',
      returnByValue: true,
    });
    if (
      state.result.value?.startsWith(
        `http://127.0.0.1:${server.address().port}`,
      )
    )
      break;
  }
  const grid = (update = {}) =>
    packShaderGrid({
      width: 2,
      height: 2,
      bounds: [170, -20, 190, 20],
      projection: 'equirectangular',
      channels: 2,
      units: 'm/s',
      interpolation: 'linear',
      values: [1, 10, 2, 20, 3, 30, 4, 40],
      ...update,
    });
  const world = (lng, lat) => [
    (lng + 180) / 360,
    (1 - Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) / Math.PI) / 2,
  ];
  const cases = [
    {
      name: 'bilinear dateline',
      data: grid(),
      point: world(-180, 0),
      expected: [2.5, 25, 1, 6.25],
    },
    {
      name: 'nearest dateline',
      data: grid({ interpolation: 'nearest' }),
      point: world(-176, -10),
      expected: [4, 40, 1, 6.25],
    },
    {
      name: 'outside',
      data: grid(),
      point: world(160, 0),
      expected: [0, 0, 0, 6.25],
    },
    {
      name: 'masked interpolation',
      data: grid({ mask: [1, 0, 1, 1] }),
      point: world(180, 0),
      expected: [0, 0, 0, 6.25],
    },
    {
      name: 'zero weight missing neighbour',
      data: grid({ mask: [0, 0, 1, 1], projection: 'mercator' }),
      point: world(180, -20),
      expected: [3.5, 35, 1, 6.25],
    },
    {
      name: 'scalar',
      data: grid({ channels: 1, values: [1, 2, 3, 4] }),
      point: world(180, 0),
      expected: [2.5, 0, 1, 6.25],
    },
    {
      name: 'single node',
      data: grid({ width: 1, height: 1, values: [8, 9] }),
      point: world(180, 0),
      expected: [8, 9, 1, 6.25],
    },
    {
      name: 'removed',
      data: packShaderGrid(undefined),
      point: world(180, 0),
      expected: [0, 0, 0, 6.25],
    },
  ];
  const expression = `(${async function (
    prelude,
    vertex,
    shaderSources,
    cases,
    windData,
    rasterInterior,
  ) {
    const adapter = await navigator.gpu?.requestAdapter();
    if (!adapter) throw new Error('No WebGPU adapter');
    const device = await adapter.requestDevice();
    const errors = [];
    device.addEventListener('uncapturederror', (e) =>
      errors.push(e.error.message),
    );
    try {
      for (const source of [vertex, ...shaderSources]) {
        const info = await device
          .createShaderModule({ code: prelude + source })
          .getCompilationInfo();
        const failures = info.messages.filter((m) => m.type === 'error');
        if (failures.length)
          throw new Error(
            JSON.stringify(
              failures.map((m) => ({ line: m.lineNum, text: m.message })),
            ),
          );
      }
      // Validate real render/compute layouts in addition to individual modules.
      const bindLayout = (computing) =>
        device.createBindGroupLayout({
          entries: [
            {
              binding: 0,
              visibility: computing
                ? GPUShaderStage.COMPUTE
                : GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
              buffer: {
                type: 'uniform',
                hasDynamicOffset: true,
                minBindingSize: 64,
              },
            },
            ...[1, 2, 3, 4].map((binding) => ({
              binding,
              visibility: computing
                ? GPUShaderStage.COMPUTE
                : GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
              buffer: {
                type:
                  binding === 1 || binding === 4
                    ? 'uniform'
                    : binding === 2 && computing
                      ? 'storage'
                      : 'read-only-storage',
              },
            })),
          ],
        });
      for (const [v, f] of [
        [vertex, shaderSources[0]],
        [shaderSources[2], shaderSources[3]],
      ]) {
        await device.createRenderPipelineAsync({
          layout: device.createPipelineLayout({
            bindGroupLayouts: [bindLayout(false)],
          }),
          vertex: {
            module: device.createShaderModule({ code: prelude + v }),
            entryPoint: 'vertexMain',
          },
          fragment: {
            module: device.createShaderModule({ code: prelude + f }),
            entryPoint: 'fragmentMain',
            targets: [{ format: 'bgra8unorm' }],
          },
        });
      }
      await device.createComputePipelineAsync({
        layout: device.createPipelineLayout({
          bindGroupLayouts: [bindLayout(true)],
        }),
        compute: {
          module: device.createShaderModule({
            code: prelude + shaderSources[1],
          }),
          entryPoint: 'computeMain',
        },
      });
      const results = [];
      // Run the actual particle compute program: forecasting velocities must
      // accumulate at 60 Hz, including after replacing the vector field.
      const particlePipeline = await device.createComputePipelineAsync({
        layout: device.createPipelineLayout({
          bindGroupLayouts: [bindLayout(true)],
        }),
        compute: {
          module: device.createShaderModule({
            code: prelude + shaderSources[1],
          }),
          entryPoint: 'computeMain',
        },
      });
      const makeBuffer = (data, usage) => {
        const b = device.createBuffer({
          size: data.byteLength,
          usage: usage | GPUBufferUsage.COPY_DST,
        });
        device.queue.writeBuffer(b, 0, data);
        return b;
      };
      const y =
        (1 -
          Math.log(Math.tan(Math.PI / 4 + (54.375 * Math.PI) / 360)) /
            Math.PI) /
        2;
      const x = (18.665 + 180) / 360;
      const clock = new Float32Array([
        0,
        1 / 60,
        rasterInterior,
        rasterInterior,
        0,
        0,
        1 / 4096,
        12,
        x - 0.0001,
        y - 0.0001,
        x + 0.0001,
        y + 0.0001,
        12,
        0,
        0,
        0,
      ]);
      const frameBuffer = makeBuffer(clock, GPUBufferUsage.UNIFORM);
      const particlesBuffer = makeBuffer(
        new Float32Array(32),
        GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
      );
      const windValues = makeBuffer(
        new Float32Array(windData.values),
        GPUBufferUsage.STORAGE,
      );
      const windMetadata = makeBuffer(
        new Float32Array(windData.metadata),
        GPUBufferUsage.UNIFORM,
      );
      const particleReadback = device.createBuffer({
        size: 128,
        usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
      });
      const displayBuffer = makeBuffer(
        new Float32Array([32, 0.06, 0.85, 1, 0.02, 0.38, 0.95, 0.9]),
        GPUBufferUsage.UNIFORM,
      );
      const particleGroup = device.createBindGroup({
        layout: particlePipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: frameBuffer } },
          { binding: 1, resource: { buffer: displayBuffer } },
          { binding: 2, resource: { buffer: particlesBuffer } },
          { binding: 3, resource: { buffer: windValues } },
          { binding: 4, resource: { buffer: windMetadata } },
        ],
      });
      const stepParticles = async (count) => {
        const encoder = device.createCommandEncoder();
        for (let i = 0; i < count; i++) {
          const pass = encoder.beginComputePass();
          pass.setPipeline(particlePipeline);
          pass.setBindGroup(0, particleGroup, [0]);
          pass.dispatchWorkgroups(1);
          pass.end();
        }
        encoder.copyBufferToBuffer(
          particlesBuffer,
          0,
          particleReadback,
          0,
          128,
        );
        device.queue.submit([encoder.finish()]);
        await particleReadback.mapAsync(GPUMapMode.READ);
        const result = [...new Float32Array(particleReadback.getMappedRange())];
        particleReadback.unmap();
        return result;
      };
      const spawned = await stepParticles(1);
      const advanced = await stepParticles(60);
      if (!(advanced[0] > spawned[0] + 1e-8) || !(advanced[0] > advanced[2]))
        throw new Error(
          'Forecast particles fail to advance at 60 Hz: ' +
            JSON.stringify({ spawned, advanced }),
        );
      if (
        advanced[8] !== advanced[0] ||
        advanced[9] !== advanced[1] ||
        !(advanced[8] > advanced[26] + 1e-8)
      )
        throw new Error(
          'Wind trail history does not retain a flowing path: ' +
            JSON.stringify(advanced),
        );
      const reversed = new Float32Array(
        windData.values.map((v, i) => (i % 4 < 2 ? -v : v)),
      );
      device.queue.writeBuffer(windValues, 0, reversed);
      const returned = await stepParticles(60);
      if (
        !(returned[0] < advanced[0] - 1e-8) ||
        returned[6] !== spawned[6] ||
        returned[7] !== spawned[7]
      )
        throw new Error(
          'Wind replacement fails to reverse motion while retaining the particle origin',
        );
      for (const b of [particlesBuffer, windValues, windMetadata]) b.destroy();
      results.push({
        name: 'forecast particle motion, trail history and live reversal at 60 Hz',
        actual: [1],
        expected: [1],
      });

      // Exercise the real vertex function as a compute helper to measure a
      // half-screen-pixel shift before rasterization at high camera zoom.
      const zoom = 17.5,
        tileZoom = 17,
        pixel = 1 / (512 * 2 ** zoom),
        tileScale = 1 / 2 ** tileZoom;
      clock[4] = Math.floor(x / tileScale) * tileScale;
      clock[5] = Math.floor(y / tileScale) * tileScale;
      clock[6] = tileScale;
      clock[7] = tileZoom;
      clock[12] = zoom;
      device.queue.writeBuffer(frameBuffer, 0, clock);
      const preciseParticles = new Float32Array(128);
      for (let i = 0; i < 4; i++) {
        const start = i * 32,
          offset = i === 1 ? pixel * 0.5 : 0;
        preciseParticles[start] = offset;
        preciseParticles[start + 2] = offset - pixel * 8;
        preciseParticles[start + 4] = 1;
        preciseParticles[start + 5] = 1;
        preciseParticles[start + 6] = x;
        preciseParticles[start + 7] = y;
        preciseParticles[start + 29] = 6;
        preciseParticles[start + 28] = i === 3 ? 0.03 : 0;
        for (let j = 0; j < 10; j++) {
          preciseParticles[start + 8 + j * 2] =
            i === 2 ? offset : offset - j * pixel;
        }
      }
      const preciseBuffer = makeBuffer(
        preciseParticles,
        GPUBufferUsage.STORAGE,
      );
      const precisionOutput = device.createBuffer({
        size: 48,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
      });
      const vertexHelper = shaderSources[2]
        .replace('@vertex fn vertexMain', 'fn windTestVertex')
        .replace('@builtin(vertex_index) ', '')
        .replace('@builtin(instance_index) ', '');
      const precisionPipeline = await device.createComputePipelineAsync({
        layout: 'auto',
        compute: {
          module: device.createShaderModule({
            code:
              prelude +
              vertexHelper +
              `
          @group(1) @binding(0) var<storage,read_write> precisionResult:array<vec4f,3>;
          @compute @workgroup_size(1) fn precisionCheck() {
            let a=windTestVertex(1u,0u).position;let b=windTestVertex(1u,1u).position;
            precisionResult[0]=vec4f(a.x,b.x,b.x-a.x,1);
            let degenerate=windTestVertex(1u,2u);
            precisionResult[1]=vec4f(degenerate.position.xy,degenerate.position.z,degenerate.alpha);
            let tail0=windTestVertex(0u,0u).position;let tail1=windTestVertex(0u,3u).position;
            precisionResult[2]=vec4f(tail0.x,tail1.x,tail1.x-tail0.x,1);
          }`,
          }),
          entryPoint: 'precisionCheck',
        },
      });
      const precisionGroup = device.createBindGroup({
        layout: precisionPipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: frameBuffer } },
          { binding: 1, resource: { buffer: displayBuffer } },
          { binding: 2, resource: { buffer: preciseBuffer } },
        ],
      });
      const precisionResultGroup = device.createBindGroup({
        layout: precisionPipeline.getBindGroupLayout(1),
        entries: [{ binding: 0, resource: { buffer: precisionOutput } }],
      });
      const precisionEncoder = device.createCommandEncoder(),
        precisionPass = precisionEncoder.beginComputePass();
      precisionPass.setPipeline(precisionPipeline);
      precisionPass.setBindGroup(0, precisionGroup);
      precisionPass.setBindGroup(1, precisionResultGroup);
      precisionPass.dispatchWorkgroups(1);
      precisionPass.end();
      precisionEncoder.copyBufferToBuffer(
        precisionOutput,
        0,
        particleReadback,
        0,
        48,
      );
      device.queue.submit([precisionEncoder.finish()]);
      await particleReadback.mapAsync(GPUMapMode.READ);
      const projected = [
        ...new Float32Array(particleReadback.getMappedRange()).slice(0, 12),
      ];
      particleReadback.unmap();
      if (!projected.slice(4).every(Number.isFinite) || projected[7] !== 0)
        throw new Error(
          'Zero-length particle trails produce unstable vertex output: ' +
            JSON.stringify(projected),
        );
      const expectedShift =
        (((pixel * 0.5) / tileScale) * 2 * rasterInterior) /
        (rasterInterior + 4);
      if (Math.abs(projected[2] - expectedShift) > 0.000001)
        throw new Error(
          'High-zoom subpixel motion collapses during projection: ' +
            JSON.stringify({ projected, expectedShift }),
        );
      if (Math.abs(projected[10] - expectedShift) > 0.000001)
        throw new Error(
          'Trail history jumps between sample updates: ' +
            JSON.stringify(projected),
        );
      preciseBuffer.destroy();
      precisionOutput.destroy();
      particleReadback.destroy();
      frameBuffer.destroy();
      displayBuffer.destroy();
      results.push({
        name: 'high-zoom half-pixel projection and smooth trail sampling',
        actual: [projected[2]],
        expected: [expectedShift],
      });
      const coverageHelper = shaderSources[3].match(
        /fn windCoverage[\s\S]*?(?=@fragment)/,
      )?.[0];
      if (!coverageHelper)
        throw new Error('Wind stroke coverage helper is missing');
      const coverageClock = makeBuffer(clock, GPUBufferUsage.UNIFORM);
      const coverageOutput = device.createBuffer({
        size: 64,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
      });
      const coverageReadback = device.createBuffer({
        size: 64,
        usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
      });
      const coveragePipeline = await device.createComputePipelineAsync({
        layout: 'auto',
        compute: {
          entryPoint: 'coverageCheck',
          module: device.createShaderModule({
            code:
              prelude +
              coverageHelper +
              `
          @group(1) @binding(0) var<storage,read_write> coverageResults:array<vec2f,8>;
          @compute @workgroup_size(1) fn coverageCheck(@builtin(global_invocation_id) gid:vec3u) {
            let bad=bitcast<f32>(0x7fc00000u+gid.x);
            coverageResults[0]=vec2f(windCoverage(bad,0,1,1),frame.zoom);
            coverageResults[1]=vec2f(windCoverage(1,bad,1,1),frame.zoom);
            coverageResults[2]=vec2f(windCoverage(1,0,1,1),frame.zoom);
            coverageResults[3]=vec2f(windCoverage(0.5,0,1,1),frame.zoom);
            coverageResults[4]=vec2f(windCoverage(0,0,1,1),frame.zoom);
            for(var i=0u;i<3u;i++) {
              let phase=f32(i)*0.75;
              let energy=windCoverage(1,phase-3.0,1,3)+windCoverage(1,phase,1,3)+windCoverage(1,phase+3.0,1,3);
              coverageResults[5u+i]=vec2f(energy,frame.zoom);
            }
          }`,
          }),
        },
      });
      const coverageFrameGroup = device.createBindGroup({
        layout: coveragePipeline.getBindGroupLayout(0),
        entries: [{ binding: 0, resource: { buffer: coverageClock } }],
      });
      const coverageResultGroup = device.createBindGroup({
        layout: coveragePipeline.getBindGroupLayout(1),
        entries: [{ binding: 0, resource: { buffer: coverageOutput } }],
      });
      const coverageEncoder = device.createCommandEncoder(),
        coveragePass = coverageEncoder.beginComputePass();
      coveragePass.setPipeline(coveragePipeline);
      coveragePass.setBindGroup(0, coverageFrameGroup);
      coveragePass.setBindGroup(1, coverageResultGroup);
      coveragePass.dispatchWorkgroups(1);
      coveragePass.end();
      coverageEncoder.copyBufferToBuffer(
        coverageOutput,
        0,
        coverageReadback,
        0,
        64,
      );
      device.queue.submit([coverageEncoder.finish()]);
      await coverageReadback.mapAsync(GPUMapMode.READ);
      const coverageValues = [
        ...new Float32Array(coverageReadback.getMappedRange()),
      ].filter((_, i) => i % 2 === 0);
      coverageReadback.unmap();
      const expectedCoverage = [0, 0, 1, 0.5, 0, 2 / 3, 2 / 3, 2 / 3];
      if (
        !coverageValues.every(
          (v, i) =>
            Number.isFinite(v) && Math.abs(v - expectedCoverage[i]) < 1e-6,
        )
      )
        throw new Error(
          'Wind stroke coverage produces invalid pixels or unstable subpixel brightness: ' +
            JSON.stringify(coverageValues),
        );
      coverageClock.destroy();
      coverageOutput.destroy();
      coverageReadback.destroy();
      results.push({
        name: 'finite wind opacity and stable subpixel coverage',
        actual: coverageValues,
        expected: expectedCoverage,
      });
      for (const entry of cases) {
        device.pushErrorScope('validation');
        const code =
          prelude +
          `\n@group(1) @binding(0) var<storage,read_write> result:vec4f;
          @compute @workgroup_size(1) fn check() {
            let s=mapSampleGrid(vec2f(${entry.point[0]},${entry.point[1]}));
            result=vec4f(s.value,s.valid,frame.zoom);
          }`;
        const pipeline = await device.createComputePipelineAsync({
          layout: 'auto',
          compute: {
            module: device.createShaderModule({ code }),
            entryPoint: 'check',
          },
        });
        const buffer = (data, usage) => {
          const b = device.createBuffer({
            size: data.byteLength,
            usage: usage | GPUBufferUsage.COPY_DST,
          });
          device.queue.writeBuffer(b, 0, data);
          return b;
        };
        const frame = new Float32Array(16);
        frame[12] = 6.25;
        const builtin = buffer(frame, GPUBufferUsage.UNIFORM);
        const values = buffer(
          new Float32Array(entry.data.values),
          GPUBufferUsage.STORAGE,
        );
        const metadata = buffer(
          new Float32Array(entry.data.metadata),
          GPUBufferUsage.UNIFORM,
        );
        const output = device.createBuffer({
          size: 16,
          usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
        });
        const readback = device.createBuffer({
          size: 16,
          usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
        });
        const group0 = device.createBindGroup({
          layout: pipeline.getBindGroupLayout(0),
          entries: [
            { binding: 0, resource: { buffer: builtin } },
            { binding: 3, resource: { buffer: values } },
            { binding: 4, resource: { buffer: metadata } },
          ],
        });
        const group1 = device.createBindGroup({
          layout: pipeline.getBindGroupLayout(1),
          entries: [{ binding: 0, resource: { buffer: output } }],
        });
        const encoder = device.createCommandEncoder();
        const pass = encoder.beginComputePass();
        pass.setPipeline(pipeline);
        pass.setBindGroup(0, group0);
        pass.setBindGroup(1, group1);
        pass.dispatchWorkgroups(1);
        pass.end();
        encoder.copyBufferToBuffer(output, 0, readback, 0, 16);
        device.queue.submit([encoder.finish()]);
        await readback.mapAsync(GPUMapMode.READ);
        const actual = [...new Float32Array(readback.getMappedRange())];
        readback.unmap();
        for (const b of [builtin, values, metadata, output, readback])
          b.destroy();
        const error = await device.popErrorScope();
        if (error) throw new Error(error.message);
        results.push({ name: entry.name, actual, expected: entry.expected });
      }
      if (errors.length) throw new Error(errors.join('\n'));
      return results;
    } finally {
      device.destroy();
    }
  }.toString()})(${JSON.stringify(shaderPrelude + shaderGridPrelude)},${JSON.stringify(defaultShaderVertex)},${JSON.stringify([shaders.shaderSource, shaders.windCompute, shaders.windVertex, shaders.windFragment])},${JSON.stringify(cases)},${JSON.stringify(packShaderGrid(shaders.windGrid))},${JSON.stringify(shaderTileInterior)})`;
  const result = await send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
    timeout: 30000,
  });
  assert.ok(!result.exceptionDetails, JSON.stringify(result.exceptionDetails));
  for (const { name, actual, expected } of result.result.value) {
    actual.forEach((v, i) =>
      assert.ok(
        Math.abs(v - expected[i]) < 0.0001,
        `${name}: got ${actual}, expected ${expected}`,
      ),
    );
    console.log(`PASS ${name}`);
  }
  console.log(
    'WGSL stages compile; numerical sampling checks pass (software WebGPU).',
  );
} finally {
  socket?.close();
  server.closeAllConnections();
  server.close();
}
