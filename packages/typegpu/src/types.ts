import type { TgpuRoot } from 'typegpu';
import type { Camera } from 'react-native-enhanced-maps';

/** Provisional context. No provider projection matrix is assumed to exist. */
export interface MapGpuFrame {
  readonly camera: Camera;
  readonly timestampMs: number;
  readonly widthPixels: number;
  readonly heightPixels: number;
  readonly pixelRatio: number;
}
export interface MapGpuRenderer {
  render(frame: MapGpuFrame): void;
  dispose(): void;
}
export type CreateMapGpuRenderer = (root: TgpuRoot) => MapGpuRenderer;
export type MapGpuStatus =
  | { readonly state: 'initializing' }
  | { readonly state: 'ready' }
  | {
      readonly state: 'error';
      readonly code:
        'unavailable' | 'initialization' | 'render' | 'device-lost';
      readonly message: string;
    }
  | { readonly state: 'disposed' };
