import type { ComponentType, ReactNode } from 'react';
import type { StyleProp, ViewStyle, ViewProps } from 'react-native';
import type { JSONValue } from './layers';

export interface MapFeaturePressEvent {
  readonly cluster?: ClusterHandle;
  readonly sourceId: string;
  readonly layerId: string;
  readonly featureId: string;
  readonly properties: Readonly<Record<string, JSONValue>>;
  readonly coordinate: Coordinate;
  readonly position: Readonly<{ x: number; y: number }>;
}

export type MapPlatform = 'ios' | 'android';
export interface MapPressEvent {
  readonly stopPropagation: () => void;
  readonly nativeEvent: {
    readonly action: 'press' | 'long-press';
    readonly coordinate: Coordinate;
    readonly position: MapPoint;
  };
  readonly action: 'tap' | 'long-press';
  readonly coordinate: Coordinate;
  readonly position: Readonly<{ x: number; y: number }>;
}
export interface Coordinate {
  readonly latitude: number;
  readonly longitude: number;
}
export interface MapPoint {
  readonly x: number;
  readonly y: number;
}
/** SDK geographic envelope; east may be west of west when crossing the antimeridian. */
export interface MapBounds {
  readonly north: number;
  readonly south: number;
  readonly east: number;
  readonly west: number;
}
export interface MapPadding {
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
}
export interface FitOptions {
  readonly padding?: number | MapPadding;
  readonly durationMs?: number;
}
export interface Camera {
  readonly center: Coordinate;
  readonly zoom: number;
  readonly heading: number;
  readonly pitch: number;
}
export type CameraOrigin = 'gesture' | 'application' | 'sdk' | 'unknown';
export interface CameraEvent {
  readonly camera: Camera;
  readonly origin: CameraOrigin;
}
export type MapGestureKind = 'pan' | 'zoom' | 'rotate' | 'tilt';
export type MapGesturePhase = 'begin' | 'update' | 'end' | 'cancel';
export interface MapGestureEvent {
  readonly kind: MapGestureKind;
  readonly phase: MapGesturePhase;
  readonly id: number;
  readonly timestampMs: number;
  readonly position: Readonly<{ x: number; y: number }>;
}
export interface MapError {
  readonly code: string;
  readonly message: string;
  readonly fatal: boolean;
}
export interface MapSettings {
  /** Persistent logical-point viewport insets. Default zero. */
  readonly mapPadding?: number | MapPadding;
  readonly scrollEnabled?: boolean;
  readonly zoomEnabled?: boolean;
  readonly rotateEnabled?: boolean;
  readonly pitchEnabled?: boolean;
  readonly showsCompass?: boolean;
  /** Portable zoom interval, inclusive, within [0,24]. Defaults to 0. */
  readonly minZoomLevel?: number;
  /** Defaults to 24. SDK geometry and viewport constraints may clamp further. */
  readonly maxZoomLevel?: number;
}
export type LatLng = Coordinate;
export type Point = MapPoint;
export type EdgePadding = MapPadding;
export interface Region extends Coordinate {
  readonly latitudeDelta: number;
  readonly longitudeDelta: number;
}
export interface CameraAnimationOptions {
  readonly duration?: number;
}
export interface FitToOptions {
  readonly edgePadding?: EdgePadding;
  readonly animated?: boolean;
}
export interface RegionChangeDetails {
  readonly isGesture: boolean;
}
export interface MapViewProps
  extends
    MapSettings,
    Pick<
      ViewProps,
      | 'onLayout'
      | 'accessible'
      | 'accessibilityLabel'
      | 'accessibilityHint'
      | 'accessibilityRole'
      | 'accessibilityState'
      | 'importantForAccessibility'
      | 'pointerEvents'
    > {
  readonly initialRegion?: Region;
  readonly region?: Region;
  readonly camera?: Camera;
  readonly onRegionChange?: (
    region: Region,
    details: RegionChangeDetails,
  ) => void;
  readonly onRegionChangeComplete?: (
    region: Region,
    details: RegionChangeDetails,
  ) => void;
  /** Custom cluster contents; omitted uses a count bubble that expands on press. */
  readonly clusterComponent?: ComponentType<ClusterComponentProps>;
  readonly styleURL: string;
  readonly children?: ReactNode;
  readonly initialCamera?: Camera;
  readonly style?: StyleProp<ViewStyle>;
  readonly testID?: string;
  readonly onMapReady?: () => void;
  /** Confirmed single tap with no interactive feature hit. Marker children keep their own input. */
  readonly onPress?: (event: MapPressEvent) => void;
  /** Native stationary long press; does not also select a feature. */
  readonly onLongPress?: (event: MapPressEvent) => void;
  readonly onCapabilitiesChange?: (
    capabilities: MapCapabilities | null,
  ) => void;
  readonly onGesture?: (event: MapGestureEvent) => void;
  /** Native update interval, 16–1000ms; begin/end/cancel bypass it. Default 50ms. */
  readonly gestureEventIntervalMs?: number;
  readonly onCameraIdle?: (event: CameraEvent) => void;
  readonly onError?: (error: MapError) => void;
}
export interface MapViewRef {
  /** Resolves when the native fit command is accepted, not when animation completes. */
  fitCoordinates(
    coordinates: readonly Coordinate[],
    options?: FitOptions,
  ): Promise<void>;
  fitElements(options?: FitOptions & FitToOptions): Promise<void>;
  fitToElements(options?: FitToOptions): Promise<void>;
  fitToCoordinates(
    coordinates: readonly Coordinate[],
    options?: FitToOptions,
  ): Promise<void>;
  getMapBoundaries(): Promise<{ northEast: Coordinate; southWest: Coordinate }>;
  getCamera(): Promise<Camera>;
  setCamera(camera: Partial<Camera>): Promise<void>;
  animateToRegion(region: Region, duration?: number): Promise<void>;
  pointForCoordinate(coordinate: Coordinate): Promise<MapPoint>;
  coordinateForPoint(point: MapPoint): Promise<Coordinate>;
  getVisibleBounds(): Promise<MapBounds>;
  /** Native report for this ready map; null before readiness, on style reload or after disposal. */
  getCapabilities(): MapCapabilities | null;
  /** An accepted command is not evidence that the camera animation completed. */
  animateCamera(
    camera: Partial<Camera>,
    options?: number | CameraAnimationOptions,
  ): void;
}
export interface ClusterMember {
  readonly id: string;
  readonly coordinate: Coordinate;
  readonly data: unknown;
}
export interface ClusterComponentProps {
  /** Group shared by this cluster’s markers; undefined for the default group. */
  readonly clusterGroup?: string;
  readonly count: number;
  readonly coordinate: Coordinate;
  /** Fetches all members in bounded native pages. Rejects for obsolete clusters. */
  readonly getMembers: () => Promise<readonly ClusterMember[]>;
  readonly expand: () => Promise<void>;
}
declare const clusterHandleBrand: unique symbol;
/** Opaque, map-owned handle; copies and handles from obsolete indexes reject. */
export interface ClusterHandle {
  readonly [clusterHandleBrand]: true;
  readonly sourceId: string;
  readonly id: number;
  readonly pointCount: number;
}
export interface ClusterPageOptions {
  readonly limit?: number;
  readonly offset?: number;
}
export interface ClusterFeature {
  readonly featureId: string;
  readonly coordinate: Coordinate;
  readonly properties: Readonly<Record<string, JSONValue>>;
  readonly cluster?: ClusterHandle;
}
export interface ClusterPage {
  readonly features: readonly ClusterFeature[];
  readonly total: number;
  readonly offset: number;
}
export type FeatureId = string;
export type SourceRevision = number;
export type LayerKind =
  'circle' | 'symbol' | 'line' | 'fill' | 'raster' | 'heatmap';
/** Capability states are evidence, not promises based on a provider name. */
export type Capability = 'supported' | 'unsupported' | 'unvalidated';
export interface MapCapabilities {
  readonly engine: 'maplibre';
  readonly platform: MapPlatform;
  readonly shaders: Capability;
  readonly layers: Readonly<Record<LayerKind, Capability>>;
  readonly detailedGestures: Capability;
}
