/// <reference types="@webgpu/types" />
import { installWebGPU } from 'react-native-webgpu';
import type { GPUSharedTextureMemory } from 'react-native-webgpu';
import type { Synchronizable } from 'react-native-worklets';
import { packShaderUniforms, shaderFrameByteLength } from './shaderContract';
import type { ShaderFrame, ShaderGridPacket } from './shaderContract';
import { expandShaderCamera, scaleShaderCamera } from './shaderViewport';
export interface ShaderNativeHandle {
  acquire(): number;
  setZoomRange(minZoom?: number, maxZoom?: number): void;
  camera(): number[];
  publishViewport(slot: number, camera: number[]): boolean;
  stats(): { produced: number; sampled: number; error: string };
}
export interface ShaderControl {
  stopped: boolean;
  active: boolean;
  paused: boolean;
  minZoom?: number | undefined;
  maxZoom?: number | undefined;
  gridVersion?: number;
  uniforms: readonly number[] | ((frame: ShaderFrame) => readonly number[]);
}
export interface ShaderWorkletConfig {
  viewport: {
    width: number;
    height: number;
    pixelRatio: number;
    padding?: number;
    scale?: number;
  };
  handle: ShaderNativeHandle;
  control: Synchronizable<ShaderControl>;
  device: GPUDevice;
  outputs: { memory: GPUSharedTextureMemory; texture: GPUTexture }[];
  pipeline: GPURenderPipeline;
  group: GPUBindGroup;
  compute?: {
    pipeline: GPUComputePipeline;
    group: GPUBindGroup;
    workgroups: readonly [number, number?, number?];
  };
  builtin: GPUBuffer;
  user: GPUBuffer;
  gridResources?: {
    data: Synchronizable<ShaderGridPacket>;
    renderLayout: GPUBindGroupLayout;
    computeLayout?: GPUBindGroupLayout | undefined;
    storage: GPUBuffer;
    metadata: GPUBuffer;
    storageUsage: GPUBufferUsageFlags;
  };
  vertexCount: number;
  instanceCount: number;
}
/** Only the dedicated worklet runtime encodes/submits frames or imports/accesses output textures. */
export async function runShaderFrames(
  config: ShaderWorkletConfig,
): Promise<void> {
  'worklet';
  installWebGPU();
  const {
    device,
    outputs,
    pipeline,
    group: initialGroup,
    compute,
    builtin,
    user,
    handle,
    control,
  } = config;
  const clock = new Float32Array(40),
    packet = new Float32Array(1024);
  let time = 0,
    last = Date.now(),
    frames = 0;
  let group = initialGroup,
    computeGroup = compute?.group;
  let gridBuffer: GPUBuffer | undefined,
    gridVersion = -1;
  let hidden = false;
  try {
    while (!control.getBlocking().stopped) {
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => resolve()),
      );
      const state = control.getBlocking();
      if (state.stopped) break;
      const now = Date.now(),
        delta = Math.min((now - last) / 1000, 0.05);
      if (!state.active) {
        last = now;
        continue;
      }
      let camera = handle.camera();
      if (
        camera.length !== 27 ||
        camera[5] !== config.viewport.width ||
        camera[6] !== config.viewport.height
      ) {
        last = now;
        continue;
      }
      if (camera && config.viewport.scale)
        camera = scaleShaderCamera(camera, config.viewport.scale);
      if (camera && config.viewport.padding) {
        camera = expandShaderCamera(camera, config.viewport.padding);
        if (!camera.length) {
          last = now;
          continue;
        }
      }
      const view = camera.slice(0, 5);
      const inRange =
        view[4]! >= (state.minZoom ?? -Infinity) &&
        view[4]! < (state.maxZoom ?? Infinity);
      if (!inRange) {
        last = now;
        if (hidden) continue;
      }
      const slot = handle.acquire();
      if (slot < 0) continue;
      last = now;
      const resources = config.gridResources;
      if (inRange && resources && gridVersion !== (state.gridVersion ?? 0)) {
        const data = resources.data.getBlocking();
        const next = device.createBuffer({
          size: data.values.length * 4,
          usage: resources.storageUsage,
        });
        try {
          device.queue.writeBuffer(next, 0, new Float32Array(data.values));
          device.queue.writeBuffer(
            resources.metadata,
            0,
            new Float32Array(data.metadata),
          );
          const bind = (layout: GPUBindGroupLayout) =>
            device.createBindGroup({
              layout,
              entries: [
                {
                  binding: 0,
                  resource: { buffer: builtin, size: shaderFrameByteLength },
                },
                { binding: 1, resource: { buffer: user } },
                { binding: 2, resource: { buffer: resources.storage } },
                { binding: 3, resource: { buffer: next } },
                { binding: 4, resource: { buffer: resources.metadata } },
              ],
            });
          group = bind(resources.renderLayout);
          if (resources.computeLayout)
            computeGroup = bind(resources.computeLayout);
        } catch (error) {
          next.destroy();
          throw error;
        }
        gridBuffer?.destroy();
        gridBuffer = next;
        gridVersion = state.gridVersion ?? 0;
      }
      const step = state.paused || !inRange ? 0 : delta;
      time += step;
      const frame = {
        time,
        delta: step,
        width: camera[5]!,
        height: camera[6]!,
        zoom: view[4]!,
      };
      const values = !inRange
        ? []
        : typeof state.uniforms === 'function'
          ? state.uniforms(frame)
          : state.uniforms;
      packet.fill(0);
      packet.set(packShaderUniforms(values));
      clock.set([
        time,
        step,
        frame.width,
        frame.height,
        camera[7]!,
        camera[8]!,
        0,
        0,
        view[0]!,
        view[1]!,
        view[2]!,
        view[3]!,
        view[4]!,
        config.viewport.pixelRatio,
        0,
        0,
      ]);
      // Row-major native homographies -> padded column-major WGSL mat3x3.
      for (let matrix = 0; matrix < 2; matrix++)
        for (let col = 0; col < 3; col++)
          for (let row = 0; row < 3; row++)
            clock[16 + matrix * 12 + col * 4 + row] =
              camera[9 + matrix * 9 + row * 3 + col]!;
      const output = outputs[slot]!;
      output.memory.beginAccess(output.texture, false);
      let ended = false;
      try {
        device.queue.writeBuffer(builtin, 0, clock);
        device.queue.writeBuffer(user, 0, packet);
        const encoder = device.createCommandEncoder();
        if (compute && !state.paused && inRange) {
          const pass = encoder.beginComputePass();
          pass.setPipeline(compute.pipeline);
          pass.setBindGroup(0, computeGroup!);
          pass.dispatchWorkgroups(
            compute.workgroups[0],
            compute.workgroups[1] ?? 1,
            compute.workgroups[2] ?? 1,
          );
          pass.end();
        }
        const pass = encoder.beginRenderPass({
          colorAttachments: [
            {
              view: output.texture.createView(),
              clearValue: [0, 0, 0, 0],
              loadOp: 'clear',
              storeOp: 'store',
            },
          ],
        });
        pass.setPipeline(pipeline);
        if (inRange) {
          pass.setViewport(0, 0, frame.width, frame.height, 0, 1);
          pass.setScissorRect(0, 0, frame.width, frame.height);
          pass.setBindGroup(0, group);
          pass.draw(config.vertexCount, config.instanceCount);
        }
        pass.end();
        device.queue.submit([encoder.finish()]);
        const access = output.memory.endAccess(output.texture);
        ended = true;
        try {
          await device.queue.onSubmittedWorkDone();
        } finally {
          access.fences.forEach(({ fence }) => fence.destroy());
        }
      } finally {
        if (!ended) {
          const access = output.memory.endAccess(output.texture);
          access.fences.forEach(({ fence }) => fence.destroy());
        }
      }
      if (control.getBlocking().stopped) break;
      if (!handle.publishViewport(slot, camera))
        throw new Error('Shader output publication rejected');
      hidden = !inRange;
      if (++frames % 60 === 0) {
        const stats = handle.stats();
        if (stats.error) throw new Error(stats.error);
      }
    }
  } finally {
    gridBuffer?.destroy();
  }
}
