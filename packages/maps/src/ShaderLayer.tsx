/// <reference types="@webgpu/types" />
import { useContext, useEffect, useMemo, useRef } from 'react';
import { AppState, NativeModules } from 'react-native';
import type { GPUSharedTextureMemory } from 'react-native-webgpu';
import type { Synchronizable } from 'react-native-worklets';
import { createShaderControlChannel } from './shaderControl';
import type { ShaderControlChannel } from './shaderControl';
import { ShaderMapContext } from './shaderContext';
import { shaderViewportPadding } from './shaderViewport';
import { getShaderRuntime } from './shaderRuntime';
import { shaderDevices } from './shaderDevice';
import type { ShaderDeviceLease } from './shaderDevice';
import { runShaderRecovery, releaseShaderResources } from './shaderRecovery';
import {
  defaultShaderVertex,
  packShaderGrid,
  shaderPrelude,
  shaderFrameByteLength,
  shaderGridPrelude,
  validateShaderOptions,
} from './shaderContract';
import type { ShaderLayerProps, ShaderGridPacket } from './shaderContract';
import type { ShaderNativeHandle, ShaderWorkletConfig } from './shaderWorklet';
interface Pool {
  id: string;
  handles: string[];
  format: GPUTextureFormat;
  size: number;
  width: number;
  height: number;
}
interface Bridge {
  install(): boolean;
  create(width: number, height: number): Promise<Pool>;
  release(id: string): Promise<void>;
}
/** World-anchored viewport with one persistent layer-wide simulation, submitted on a dedicated worklet runtime. */
export function ShaderLayer(props: ShaderLayerProps) {
  validateShaderOptions(props);
  const host = useContext(ShaderMapContext);
  if (!host) throw new Error('ShaderLayer must be a MapView child');
  const grid = useMemo(() => packShaderGrid(props.data), [props.data]);
  const latestGrid = useRef(grid);
  latestGrid.current = grid;
  const latest = useRef(props);
  latest.current = props;
  const serial = useRef<Promise<void>>(Promise.resolve());
  const controlRef = useRef<ShaderControlChannel | null>(null);
  const gridRef = useRef<Synchronizable<ShaderGridPacket> | null>(null);
  const nativeRef = useRef<ShaderNativeHandle | null>(null);
  const {
    id,
    shaders,
    beforeId,
    placement = 'below-labels',
    resolutionScale = 0.5,
    visible = true,
    allowSoftwareAdapter = false,
    vertexCount = props.shaders.vertex ? 3 : 6,
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
    nativeRef.current?.setZoomRange(props.minZoom, props.maxZoom);
    const control = controlRef.current;
    if (control)
      control.update({
        paused: props.paused ?? false,
        uniforms: props.uniforms ?? [],
        minZoom: props.minZoom,
        maxZoom: props.maxZoom,
      });
  }, [props.paused, props.uniforms, props.minZoom, props.maxZoom]);
  useEffect(() => {
    gridRef.current?.setBlocking(grid);
    controlRef.current?.update((previous) => ({
      gridVersion: (previous.gridVersion ?? 0) + 1,
    }));
  }, [grid]);
  useEffect(() => {
    if (!host.ready || !visible) return;
    if (!host.viewport || host.viewport.width < 1 || host.viewport.height < 1)
      return;
    const viewport = {
      ...host.viewport,
      scale: resolutionScale,
      pixelRatio: host.viewport.pixelRatio * resolutionScale,
      padding: shaderViewportPadding(
        Math.ceil(host.viewport.width * resolutionScale),
        Math.ceil(host.viewport.height * resolutionScale),
      ),
    };
    let stopped = false;
    let localControl: ShaderControlChannel | undefined;
    let localGrid: Synchronizable<ShaderGridPacket> | undefined;
    let cancelRetryWait: (() => void) | undefined;
    const stop = () => {
      stopped = true;
      cancelRetryWait?.();
      localControl?.update({ stopped: true });
    };
    let active = AppState.currentState === 'active';
    const subscription = AppState.addEventListener('change', (state) => {
      active = state === 'active';
      localControl?.update({ active });
    });
    const run = async () => {
      if (stopped) return false;
      let attemptStopped = false,
        recover = false;
      let clean: boolean;
      let debugLoss: (() => void) | undefined;
      let deviceLease: ShaderDeviceLease | undefined;
      const stopAttempt = () => {
        attemptStopped = true;
        localControl?.update({ stopped: true });
      };
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
        if (stopped || attemptStopped)
          throw new Error('Shader attempt stopped');
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
        localControl = createShaderControlChannel(
          {
            stopped: false,
            active,
            paused: latest.current.paused ?? false,
            uniforms,
            minZoom: latest.current.minZoom,
            maxZoom: latest.current.maxZoom,
            gridVersion: 0,
          },
          worklets.createSynchronizable,
        );
        localGrid = worklets.createSynchronizable(latestGrid.current);
        gridRef.current = localGrid;
        controlRef.current = localControl;
        const lost = (info: Pick<GPUDeviceLostInfo, 'reason' | 'message'>) => {
          if (info.reason !== 'destroyed' && !stopped && !attemptStopped) {
            recover = true;
            stopAttempt();
            report(new Error(`ShaderLayer device lost: ${info.message}`));
          }
        };
        deviceLease = await shaderDevices.acquire(
          allowSoftwareAdapter,
          lost,
          (event) => {
            if (!stopped && !attemptStopped) {
              stopAttempt();
              report(new Error(event.error.message));
            }
          },
        );
        device = deviceLease.device;
        if (__DEV__) {
          const target = globalThis as typeof globalThis & {
            __enhancedMapsShaderRecovery?: Map<string, () => void>;
          };
          const registry = (target.__enhancedMapsShaderRecovery ??= new Map());
          debugLoss = () => {
            deviceLease?.invalidate({
              reason: 'unknown',
              message: 'Debug fault injection',
            });
            device?.destroy();
          };
          registry.set(id, debugLoss);
        }
        if (stopped || attemptStopped)
          throw new Error('Shader attempt stopped');
        pool = await bridge.create(
          Math.ceil(viewport.width * viewport.scale) + 2 * viewport.padding,
          Math.ceil(viewport.height * viewport.scale) + 2 * viewport.padding,
        );
        const native = (
          globalThis as unknown as {
            __enhancedMapsShader: { open(id: string): ShaderNativeHandle };
          }
        ).__enhancedMapsShader.open(pool.id);
        nativeRef.current = native;
        native.setZoomRange(latest.current.minZoom, latest.current.maxZoom);
        for (const handle of pool.handles) {
          const memory = device.importSharedTextureMemory({
            handle: BigInt(handle),
          });
          try {
            outputs.push({
              memory,
              texture: memory.createTexture({
                size: [pool.width, pool.height],
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
            code: shaderPrelude + shaderGridPrelude + code,
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

                  minBindingSize: shaderFrameByteLength,
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
              {
                binding: 3,
                visibility: computing
                  ? gpu.GPUShaderStage.COMPUTE
                  : renderVisibility,
                buffer: { type: 'read-only-storage' },
              },
              {
                binding: 4,
                visibility: computing
                  ? gpu.GPUShaderStage.COMPUTE
                  : renderVisibility,
                buffer: { type: 'uniform' },
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
          size: shaderFrameByteLength,
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
        const gridPlaceholder = device.createBuffer({
          size: 16,
          usage: gpu.GPUBufferUsage.STORAGE | gpu.GPUBufferUsage.COPY_DST,
        });
        const gridMetadata = device.createBuffer({
          size: 48,
          usage: gpu.GPUBufferUsage.UNIFORM | gpu.GPUBufferUsage.COPY_DST,
        });
        buffers.push(gridPlaceholder, gridMetadata);
        const group = (bindingLayout: GPUBindGroupLayout) =>
          device!.createBindGroup({
            layout: bindingLayout,
            entries: [
              {
                binding: 0,
                resource: { buffer: builtin, size: shaderFrameByteLength },
              },
              { binding: 1, resource: { buffer: user } },
              { binding: 2, resource: { buffer: storage } },
              { binding: 3, resource: { buffer: gridPlaceholder } },
              { binding: 4, resource: { buffer: gridMetadata } },
            ],
          });
        let computeConfig: ShaderWorkletConfig['compute'];
        let computeLayout: GPUBindGroupLayout | undefined;
        if (cs) {
          computeLayout = layout(true);
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
        if (stopped || attemptStopped)
          throw new Error('Shader attempt stopped');
        await host.request({
          action: 'attach',
          id,
          poolId: pool.id,
          placement,
          ...(beforeId ? { beforeId } : {}),
        });
        attached = true;
        if (stopped || attemptStopped)
          throw new Error('Shader attempt stopped');
        const runtime = getShaderRuntime(() =>
          worklets.createWorkletRuntime({
            name: 'EnhancedMapsShaders',
            enableEventLoop: true,
            animationQueuePollingRate: 16,
          }),
        );
        latest.current.onReady?.();
        const controlForWorklet = localControl.synchronizable;
        const groupForWorklet = group(renderLayout);
        const gridResources = {
          data: localGrid!,
          renderLayout,
          computeLayout,
          storage,
          metadata: gridMetadata,
          storageUsage:
            gpu.GPUBufferUsage.STORAGE | gpu.GPUBufferUsage.COPY_DST,
        };
        const { scheduleOnRuntime, scheduleOnRN } = worklets;
        await new Promise<void>((resolve, reject) => {
          const finished = () => resolve();
          const failed = (message: string) => reject(new Error(message));
          scheduleOnRuntime(runtime, () => {
            'worklet';
            runShaderFrames({
              device: device!,
              viewport,
              outputs,
              pipeline,
              group: groupForWorklet,
              builtin,
              user,
              handle: native,
              control: controlForWorklet,
              vertexCount,
              instanceCount,
              gridResources,
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
        if (!attemptStopped) report(error);
      } finally {
        if (controlRef.current === localControl) {
          controlRef.current = null;
          gridRef.current = null;
          nativeRef.current = null;
        }
        if (__DEV__) {
          const target = globalThis as typeof globalThis & {
            __enhancedMapsShaderRecovery?: Map<string, () => void>;
          };
          const registry = target.__enhancedMapsShaderRecovery;
          if (registry?.get(id) === debugLoss) registry?.delete(id);
          if (registry?.size === 0) delete target.__enhancedMapsShaderRecovery;
        }
        clean = await releaseShaderResources(
          [
            async () => {
              if (attached && pool) {
                try {
                  await host.request({ action: 'remove', id, poolId: pool.id });
                } catch (error) {
                  if (!stopped) throw error;
                }
              }
            },
            async () => {
              try {
                await device?.queue.onSubmittedWorkDone();
              } catch {
                /* Lost devices reject queue completion. */
              }
            },
            ...outputs.flatMap((output) => [
              () => output.texture.destroy(),
              () => output.memory.destroy(),
            ]),
            ...buffers.map((buffer) => () => buffer.destroy()),
            async () => {
              if (pool)
                await (NativeModules.EMShaderLayer as Bridge).release(pool.id);
            },
          ],
          report,
        );
        if (!clean) {
          try {
            deviceLease?.invalidate({
              reason: 'destroyed',
              message: 'Shader resource cleanup failed',
            });
            device?.destroy();
          } catch {
            /* The cleanup error has already been reported. */
          }
        }
        deviceLease?.release();
        localControl = undefined;
      }
      return recover && clean;
    };
    serial.current = serial.current
      .then(() =>
        runShaderRecovery({
          run,
          stopped: () => stopped,
          wait: (milliseconds) =>
            new Promise<void>((resolve) => {
              const finish = () => {
                clearTimeout(timer);
                cancelRetryWait = undefined;
                resolve();
              };
              const timer = setTimeout(finish, milliseconds);
              cancelRetryWait = finish;
            }),
          exhausted: () =>
            latest.current.onError?.(
              new Error(
                'ShaderLayer device recovery exhausted; change configuration or remount to retry',
              ),
            ),
        }),
      )
      .catch((error) => {
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
    resolutionScale,
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
