export { MapView, MapView as default } from './MapView';
export { Marker } from './Marker';
export { Callout, Callout as MapCallout } from './Callout';
export type { CalloutProps, CalloutPressEvent } from './Callout';
export type { CalloutProps as MapCalloutProps } from './Callout';
export type { MarkerRef, MarkerSelectionEvent } from './Marker';
export { UrlTile } from './UrlTile';
export type { UrlTileProps } from './UrlTile';
export type { MarkerProps, MarkerPressEvent, MarkerDragEvent } from './Marker';
export { Polyline, Polygon, Circle } from './mapContent';
export type {
  PolylineProps,
  PolygonProps,
  CircleProps,
  ShapePressEvent,
} from './mapContent';
export { validateCamera, createRevisionGate } from './contracts';
export type {
  LatLng,
  Point,
  EdgePadding,
  Region,
  RegionChangeDetails,
  CameraAnimationOptions,
  FitToOptions,
  Camera,
  CameraEvent,
  CameraOrigin,
  Coordinate,
  MapPoint,
  MapBounds,
  FitOptions,
  MapViewProps,
  MapSettings,
  MapPadding,
  MapViewRef,
  MapPlatform,
  MapPressEvent,
  MapGestureKind,
  MapGesturePhase,
  MapGestureEvent,
  MapError,
  MapCapabilities,
  Capability,
  ClusterMember,
  ClusterComponentProps,
} from './types';

// Familiar RN Maps component and props names for existing imports.
export { Marker as MapMarker } from './Marker';
export type { MarkerProps as MapMarkerProps } from './Marker';
export {
  Polyline as MapPolyline,
  Polygon as MapPolygon,
  Circle as MapCircle,
} from './mapContent';
export type {
  PolylineProps as MapPolylineProps,
  PolygonProps as MapPolygonProps,
  CircleProps as MapCircleProps,
} from './mapContent';

export type { UserLocation, UserLocationChangeEvent } from './userLocation';
export type { SnapshotOptions } from './snapshots';
