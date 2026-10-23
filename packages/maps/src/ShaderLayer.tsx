/// <reference types="@webgpu/types" />
import { useContext, useEffect, useRef } from 'react';
import { AppState, NativeModules } from 'react-native';
import type { GPUSharedTextureMemory } from 'react-native-webgpu';
import type { Synchronizable } from 'react-native-worklets';
import { ShaderMapContext } from './shaderContext';
import {
  defaultShaderVertex,
  shaderPrelude,
  validateShaderLayer,
} from './shaderContract';
import type { ShaderLayerProps } from './shaderContract';
import type {
  ShaderControl,
  ShaderNativeHandle,
  ShaderWorkletConfig,
} from './shaderWorklet';
interface Pool {
  id: string;
  handles: string[];
  format: GPUTextureFormat;
  size: number;
}
interface Bridge {
  install(): boolean;
  create(size: number): Promise<Pool>;
  release(id: string): Promise<void>;
}
/** World-anchored tiles with one persistent layer-wide simulation, submitted on a dedicated worklet runtime. */
export function ShaderLayer(props: ShaderLayerProps) {
  validateShaderLayer(props);
  const host = useContext(ShaderMapContext);
  if (!host) throw new Error('ShaderLayer must be a MapView child');
  const latest = useRef(props);
  latest.current = props;
  const serial = useRef<Promise<void>>(Promise.resolve());
  const controlRef = useRef<Synchronizable<ShaderControl> | null>(null);
  const {
    id,
    shaders,
    beforeId,
    placement = 'below-labels',
    visible = true,
    allowSoftwareAdapter = false,
    vertexCount = 3,
    instanceCount = 1,
  } = props;
  const {
    vertex = defaultShaderVertex,
    fragment,
    compute,
    vertexEntryPoint = 'vertexMain',
    fragmentEntryPoint = 'fragmentMain',
    computeEntryPoint = 'computeMain',
  } = shaders;
  const byteLength = props.simulation?.byteLength ?? 16;
  const initialData = JSON.stringify(props.simulation?.initialData ?? []);
  const workgroups = JSON.stringify(props.simulation?.workgroups ?? [1]);
  useEffect(() => {
    const control = controlRef.current;
    if (control)
      control.setBlocking((previous) => ({
        ...previous,
        paused: props.paused ?? false,
        uniforms: props.uniforms ?? [],
      }));
  }, [props.paused, props.uniforms]);
  useEffect(() => {
    if (!host.ready || !visible) return;
    let stopped = false;
    let localControl: Synchronizable<ShaderControl> | undefined;
    const stop = () => {
      stopped = true;
      localControl?.setBlocking((previous) => ({ ...previous, stopped: true }));
    };
    let active = AppState.currentState === 'active';
    const subscription = AppState.addEventListener('change', (state) => {
      active = state === 'active';
      localControl?.setBlocking((previous) => ({ ...previous, active }));
    });
    const run = async () => {
      if (stopped) return;
      let pool: Pool | undefined,
        device: GPUDevice | undefined,
        attached = false;
      const outputs: { memory: GPUSharedTextureMemory; texture: GPUTexture }[] =
        [];
      const buffers: GPUBuffer[] = [];
      const report = (error: unknown) => {
        if (!stopped)
          latest.current.onError?.(
            error instanceof Error ? error : new Error(String(error)),
          );
      };
      try {
        // Lazy synchronous loading keeps ordinary maps optional and avoids Metro dev split bundles.
        /* eslint-disable @typescript-eslint/no-require-imports */
        const gpu =
          require('react-native-webgpu') as typeof import('react-native-webgpu');
        const worklets =
          require('react-native-worklets') as typeof import('react-native-worklets');
        const { runShaderFrames } =
          require('./shaderWorklet') as typeof import('./shaderWorklet');
        /* eslint-enable @typescript-eslint/no-require-imports */
        if (stopped) return;
        const uniforms = latest.current.uniforms ?? [];
        if (
          typeof uniforms === 'function' &&
          !worklets.isWorkletFunction(uniforms)
        )
          throw new Error("Shader uniforms function must contain 'worklet'");
        const bridge = NativeModules.EMShaderLayer as Bridge | undefined;
        if (!bridge || !bridge.install())
          throw new Error(
            'ShaderLayer native JSI transport unavailable; rebuild the app',
          );
        localControl = worklets.createSynchronizable<ShaderControl>({
          stopped: false,
          active,
          paused: latest.current.paused ?? false,
          uniforms,
        });
        controlRef.current = localControl;
        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter) throw new Error('WebGPU adapter unavailable');
        if (adapter.info.isFallbackAdapter && !allowSoftwareAdapter)
          throw new Error(
            'Software GPU requires explicit allowSoftwareAdapter diagnostics',
          );
        device = await adapter.requestDevice();
        void device.lost.then((info) => {
          if (info.reason !== 'destroyed' && !stopped) {
            report(new Error(`ShaderLayer device lost: ${info.message}`));
            stop();
          }
        });
        device.addEventListener('uncapturederror', (event) => {
          report(new Error(event.error.message));
          stop();
        });
        if (stopped) return;
        pool = await bridge.create(1024);
        const native = (
          globalThis as unknown as {
            __enhancedMapsShader: { open(id: string): ShaderNativeHandle };
          }
        ).__enhancedMapsShader.open(pool.id);
        for (const handle of pool.handles) {
          const memory = device.importSharedTextureMemory({
            handle: BigInt(handle),
          });
          try {
            outputs.push({
              memory,
              texture: memory.createTexture({
                size: [1024, 1024],
                format: pool.format,
                usage: gpu.GPUTextureUsage.RENDER_ATTACHMENT,
              }),
            });
          } catch (error) {
            memory.destroy();
            throw error;
          }
        }
        const module = async (code: string) => {
          const value = device!.createShaderModule({
            code: shaderPrelude + code,
          });
          const info = await value.getCompilationInfo();
          const errors = info.messages.filter(
            (message) => message.type === 'error',
          );
          if (errors.length)
            throw new Error(
              errors
                .map(
                  (message) =>
                    `${message.lineNum}:${message.linePos} ${message.message}`,
                )
                .join('\n'),
            );
          return value;
        };
        const vs = await module(vertex),
          fs = await module(fragment),
          cs = compute ? await module(compute) : undefined;
        const renderVisibility =
          gpu.GPUShaderStage.VERTEX | gpu.GPUShaderStage.FRAGMENT;
        const layout = (computing: boolean) =>
          device!.createBindGroupLayout({
            entries: [
              {
                binding: 0,
                visibility: computing
                  ? gpu.GPUShaderStage.COMPUTE
                  : renderVisibility,
                buffer: {
                  type: 'uniform',
                  hasDynamicOffset: true,
                  minBindingSize: 48,
                },
              },
              {
                binding: 1,
                visibility: computing
                  ? gpu.GPUShaderStage.COMPUTE
                  : renderVisibility,
                buffer: { type: 'uniform' },
              },
              {
                binding: 2,
                visibility: computing
                  ? gpu.GPUShaderStage.COMPUTE
                  : renderVisibility,
                buffer: { type: computing ? 'storage' : 'read-only-storage' },
              },
            ],
          });
        const renderLayout = layout(false);
        const pipeline = await device.createRenderPipelineAsync({
          layout: device.createPipelineLayout({
            bindGroupLayouts: [renderLayout],
          }),
          vertex: { module: vs, entryPoint: vertexEntryPoint },
          fragment: {
            module: fs,
            entryPoint: fragmentEntryPoint,
            targets: [
              {
                format: pool.format,
                blend: {
                  color: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' },
                  alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' },
                },
              },
            ],
          },
          primitive: { topology: 'triangle-list' },
        });
        const builtin = device.createBuffer({
          size: 4096,
          usage: gpu.GPUBufferUsage.UNIFORM | gpu.GPUBufferUsage.COPY_DST,
        });
        buffers.push(builtin);
        const user = device.createBuffer({
          size: 4096,
          usage: gpu.GPUBufferUsage.UNIFORM | gpu.GPUBufferUsage.COPY_DST,
        });
        buffers.push(user);
        const storage = device.createBuffer({
          size: byteLength,
          usage: gpu.GPUBufferUsage.STORAGE | gpu.GPUBufferUsage.COPY_DST,
        });
        buffers.push(storage);
        const initial: number[] = JSON.parse(initialData);
        if (initial.length)
          device.queue.writeBuffer(storage, 0, new Float32Array(initial));
        const group = (bindingLayout: GPUBindGroupLayout) =>
          device!.createBindGroup({
            layout: bindingLayout,
            entries: [
              { binding: 0, resource: { buffer: builtin, size: 48 } },
              { binding: 1, resource: { buffer: user } },
              { binding: 2, resource: { buffer: storage } },
            ],
          });
        let computeConfig: ShaderWorkletConfig['compute'];
        if (cs) {
          const computeLayout = layout(true);
          computeConfig = {
            pipeline: await device.createComputePipelineAsync({
              layout: device.createPipelineLayout({
                bindGroupLayouts: [computeLayout],
              }),
              compute: { module: cs, entryPoint: computeEntryPoint },
            }),
            group: group(computeLayout),
            workgroups: JSON.parse(workgroups) as readonly [
              number,
              number?,
              number?,
            ],
          };
        }
        if (stopped) return;
        await host.request({
          action: 'attach',
          id,
          poolId: pool.id,
          placement,
          ...(beforeId ? { beforeId } : {}),
        });
        attached = true;
        if (stopped) return;
        const runtime = worklets.createWorkletRuntime({
          name: `ShaderLayer:${id}`,
          enableEventLoop: true,
          animationQueuePollingRate: 16,
        });
        latest.current.onReady?.();
        const groupForWorklet = group(renderLayout);
        const { scheduleOnRuntime, scheduleOnRN } = worklets;
        await new Promise<void>((resolve, reject) => {
          const finished = () => resolve();
          const failed = (message: string) => reject(new Error(message));
          scheduleOnRuntime(runtime, () => {
            'worklet';
            runShaderFrames({
              device: device!,
              outputs,
              pipeline,
              group: groupForWorklet,
              builtin,
              user,
              handle: native,
              control: localControl!,
              vertexCount,
              instanceCount,
              ...(computeConfig ? { compute: computeConfig } : {}),
            }).then(
              () => scheduleOnRN(finished),
              (error) =>
                scheduleOnRN(
                  failed,
                  error instanceof Error ? error.message : String(error),
                ),
            );
          });
        });
      } catch (error) {
        report(error);
      } finally {
        if (controlRef.current === localControl) controlRef.current = null;
        if (attached && pool) {
          try {
            await host.request({ action: 'remove', id, poolId: pool.id });
          } catch {
            /* Style disposal already detached the layer. */
          }
        }
        try {
          await device?.queue.onSubmittedWorkDone();
        } catch {
          /* Device loss. */
        }
        for (const output of outputs) {
          output.texture.destroy();
          output.memory.destroy();
        }
        buffers.forEach((buffer) => buffer.destroy());
        if (pool) {
          try {
            await (NativeModules.EMShaderLayer as Bridge).release(pool.id);
          } catch (error) {
            report(error);
          }
        }
        device?.destroy();
      }
    };
    serial.current = serial.current.then(run).catch((error) => {
      if (!stopped)
        latest.current.onError?.(
          error instanceof Error ? error : new Error(String(error)),
        );
    });
    return () => {
      stop();
      subscription.remove();
    };
  }, [
    host,
    id,
    vertex,
    fragment,
    compute,
    vertexEntryPoint,
    fragmentEntryPoint,
    computeEntryPoint,
    beforeId,
    placement,
    visible,
    allowSoftwareAdapter,
    byteLength,
    initialData,
    workgroups,
    vertexCount,
    instanceCount,
  ]);
  return null;
}
