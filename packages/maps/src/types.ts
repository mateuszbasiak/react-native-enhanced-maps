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
export interface MapViewProps {
  readonly provider?: MapProvider;
  readonly initialCamera?: Camera;
  readonly style?: StyleProp<ViewStyle>;
  readonly testID?: string;
  readonly onMapReady?: () => void;
  readonly onCameraChange?: (event: CameraEvent) => void;
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
