/// <reference types="@webgpu/types" />
type Loss = Pick<GPUDeviceLostInfo, 'reason' | 'message'>;
interface LeaseCallbacks {
  listener?: (info: Loss) => void;
  error?: (event: GPUUncapturedErrorEvent) => void;
  loss?: Loss;
}
// A native listener is a GC root. Its closure must not retain the device entry.
function shaderErrorDispatcher(callbacks: LeaseCallbacks) {
  return (event: GPUUncapturedErrorEvent) => callbacks.error?.(event);
}
export interface ShaderDeviceLease {
  device: GPUDevice;
  release(): void;
  /** Invalidated devices are never returned to the idle pool. */
  invalidate(info: Loss): void;
}
/** Retain idle native contexts up to peak concurrency; active layers have exclusive devices. */
export function createShaderDeviceCache(
  requestAdapter: () => Promise<GPUAdapter | null>,
) {
  type Entry = {
    device: GPUDevice;
    software: boolean;
    callbacks: LeaseCallbacks;
  };
  const idle: Entry[] = [];
  const invalidate = (entry: Entry, info: Loss) => {
    const callbacks = entry.callbacks;
    if (callbacks.loss) return;
    callbacks.loss = info;
    const index = idle.indexOf(entry);
    if (index !== -1) idle.splice(index, 1);
    const listener = callbacks.listener;
    delete callbacks.listener;
    delete callbacks.error;
    listener?.(info);
  };
  return {
    async acquire(
      allowSoftware: boolean,
      onLost: (info: Loss) => void,
      onError?: (event: GPUUncapturedErrorEvent) => void,
    ): Promise<ShaderDeviceLease> {
      const index = idle.findIndex((entry) => allowSoftware || !entry.software);
      let entry = index === -1 ? undefined : idle.splice(index, 1)[0];
      if (!entry) {
        // Dawn adapters are consumed by requestDevice, even for concurrent layers.
        const selected = await requestAdapter();
        if (!selected) throw new Error('WebGPU adapter unavailable');
        if (selected.info.isFallbackAdapter && !allowSoftware)
          throw new Error(
            'Software GPU requires explicit allowSoftwareAdapter diagnostics',
          );
        const device = await selected.requestDevice();
        entry = {
          device,
          software: selected.info.isFallbackAdapter,
          callbacks: {},
        };
        const created = entry;
        // react-native-webgpu 0.17.0 removeEventListener is a native no-op.
        // Keep one dispatcher per device instead of accumulating layer closures.
        device.addEventListener(
          'uncapturederror',
          shaderErrorDispatcher(entry.callbacks),
        );
        void device.lost.then((info) => {
          try {
            invalidate(created, info);
          } catch {
            /* Loss subscribers report their own errors. */
          }
        });
      }
      const owned = entry;
      let released = false;
      if (owned.callbacks.loss) onLost(owned.callbacks.loss);
      else {
        owned.callbacks.listener = onLost;
        if (onError) owned.callbacks.error = onError;
      }
      return {
        device: owned.device,
        release: () => {
          if (released) return;
          released = true;
          delete owned.callbacks.listener;
          delete owned.callbacks.error;
          if (!owned.callbacks.loss) idle.push(owned);
        },
        invalidate: (info) => {
          if (!released) invalidate(owned, info);
        },
      };
    },
  };
}
export const shaderDevices = createShaderDeviceCache(() =>
  navigator.gpu.requestAdapter(),
);
