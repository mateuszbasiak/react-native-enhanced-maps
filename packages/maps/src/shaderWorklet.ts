/// <reference types="@webgpu/types" />
import { installWebGPU } from 'react-native-webgpu';
import type { GPUSharedTextureMemory } from 'react-native-webgpu';
import type { Synchronizable } from 'react-native-worklets';
import { packShaderUniforms } from './shaderContract';
import type { ShaderFrame, ShaderGridPacket } from './shaderContract';
import { selectShaderTiles } from './shaderTiles';
export interface ShaderNativeHandle {
  acquire(): number;
  publish(slot: number, tiles: number[]): boolean;
  view(): number[];
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
  atlasSize: number;
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
  const tileSize = config.atlasSize / 4;
  const tileInterior = tileSize - 4;
  const clock = new Float32Array(16 * 64),
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
      const view = handle.view();
      const inRange =
        view[4]! >= (state.minZoom ?? -Infinity) &&
        view[4]! < (state.maxZoom ?? Infinity);
      if (!inRange) {
        last = now;
        if (hidden) continue;
      }
      const tiles = selectShaderTiles(view);
      if (!tiles.length) continue;
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
                { binding: 0, resource: { buffer: builtin, size: 64 } },
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
        width: tileInterior,
        height: tileInterior,
        zoom: view[4]!,
      };
      const values = !inRange
        ? []
        : typeof state.uniforms === 'function'
          ? state.uniforms(frame)
          : state.uniforms;
      packet.fill(0);
      packet.set(packShaderUniforms(values));
      for (let i = 0; i < tiles.length; i++) {
        const tile = tiles[i]!,
          scale = 1 / 2 ** tile.z;
        clock.set(
          [
            time,
            step,
            tileInterior,
            tileInterior,
            tile.x * scale,
            tile.y * scale,
            scale,
            tile.z,
            view[0]!,
            view[1]!,
            view[2]!,
            view[3]!,
            view[4]!,
            0,
            0,
            0,
          ],
          i * 64,
        );
      }
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
          pass.setBindGroup(0, computeGroup!, [0]);
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
        for (let i = 0; inRange && i < tiles.length; i++) {
          const x = (i % 4) * tileSize,
            y = Math.floor(i / 4) * tileSize;
          pass.setViewport(x, y, tileSize, tileSize, 0, 1);
          pass.setScissorRect(x, y, tileSize, tileSize);
          pass.setBindGroup(0, group, [i * 256]);
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
      if (
        !handle.publish(
          slot,
          tiles.flatMap((t) => [t.x, t.y, t.z]),
        )
      )
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
