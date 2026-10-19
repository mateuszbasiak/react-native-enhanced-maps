import type { StyleProp, ViewStyle } from 'react-native';

export type MapProvider = 'apple' | 'google';
export type MapPlatform = 'ios' | 'android';
export interface Coordinate { readonly latitude: number; readonly longitude: number }
export interface Camera {
  readonly center: Coordinate;
  readonly zoom: number;
  readonly heading: number;
  readonly pitch: number;
}
export type CameraOrigin = 'gesture' | 'application' | 'sdk' | 'unknown';
export interface CameraEvent { readonly camera: Camera; readonly origin: CameraOrigin }
export interface MapError { readonly code: string; readonly message: string; readonly fatal: boolean }
/** Experimental shader snapshot, not a live GPU layer. Immutable; max 256 × 256. */
export interface ExperimentalRasterOverlay {
  readonly width: number;
  readonly height: number;
  readonly rgbaBase64: string;
  readonly bounds: { readonly north: number; readonly south: number; readonly east: number; readonly west: number };
}
export interface MapViewProps {
  readonly experimentalRasterOverlay?: ExperimentalRasterOverlay;
  readonly provider?: MapProvider;
  readonly initialCamera?: Camera;
  readonly style?: StyleProp<ViewStyle>;
  readonly testID?: string;
  readonly onMapReady?: () => void;
  /** Native notification interval, 16–1000 ms. Default 100. Idle updates bypass the limit. */
  readonly cameraEventIntervalMs?: number;
  readonly onCameraChange?: (event: CameraEvent) => void;
  /** Settled camera once per completed movement; no intermediate updates required. */
  readonly onCameraIdle?: (event: CameraEvent) => void;
  readonly onError?: (error: MapError) => void;
}
export interface MapViewRef {
  /** An accepted command is not evidence that the camera animation completed. */
  animateCamera(camera: Camera, durationMs?: number): void;
}
export type FeatureId = string;
export type SourceRevision = number;
export type LayerKind = 'circle' | 'symbol' | 'line' | 'fill' | 'raster' | 'heatmap';
/** Capability states are evidence, not promises based on a provider name. */
export type Capability = 'supported' | 'unsupported' | 'unvalidated';
export interface MapCapabilities {
  readonly shaders: Capability;
  readonly layers: Readonly<Record<LayerKind, Capability>>;
  readonly detailedGestures: Capability;
}
