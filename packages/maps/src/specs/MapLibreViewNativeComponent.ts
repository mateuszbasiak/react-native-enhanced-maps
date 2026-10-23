import type { HostComponent, ViewProps } from 'react-native';
import type {
  DirectEventHandler,
  Double,
  WithDefault,
} from 'react-native/Libraries/Types/CodegenTypes';
import codegenNativeComponent from 'react-native/Libraries/Utilities/codegenNativeComponent';
import codegenNativeCommands from 'react-native/Libraries/Utilities/codegenNativeCommands';
export interface NativeProps extends ViewProps {
  mapPaddingTop?: WithDefault<Double, 0>;
  mapPaddingRight?: WithDefault<Double, 0>;
  mapPaddingBottom?: WithDefault<Double, 0>;
  mapPaddingLeft?: WithDefault<Double, 0>;
  scrollEnabled?: WithDefault<boolean, true>;
  zoomEnabled?: WithDefault<boolean, true>;
  rotateEnabled?: WithDefault<boolean, true>;
  pitchEnabled?: WithDefault<boolean, true>;
  showsCompass?: WithDefault<boolean, true>;
  minZoomLevel?: WithDefault<Double, 0>;
  maxZoomLevel?: WithDefault<Double, 24>;
  styleURL?: WithDefault<string, ''>;
  styleRevision?: WithDefault<Double, 0>;
  sceneJSON?: WithDefault<string, ''>;
  onMarkerClusters?: DirectEventHandler<
    Readonly<{ layoutJSON: string; styleRevision: Double }>
  >;
  onMapQueryResult?: DirectEventHandler<
    Readonly<{
      requestId: Double;
      styleRevision: Double;
      resultJSON: string;
      error: string;
    }>
  >;
  mapPressEventsEnabled?: WithDefault<boolean, false>;
  onMapPress?: DirectEventHandler<
    Readonly<{
      action: string;
      latitude: Double;
      longitude: Double;
      x: Double;
      y: Double;
      styleRevision: Double;
    }>
  >;
  gestureEventsEnabled?: WithDefault<boolean, false>;
  gestureSubscriptionRevision?: WithDefault<Double, 0>;
  gestureEventIntervalMs?: WithDefault<Double, 50>;
  onGesture?: DirectEventHandler<
    Readonly<{
      kind: string;
      phase: string;
      id: Double;
      timestampMs: Double;
      x: Double;
      y: Double;
      subscriptionRevision: Double;
    }>
  >;
  textureMode?: WithDefault<boolean, false>;
  initialLatitude?: WithDefault<Double, 0>;
  initialLongitude?: WithDefault<Double, 0>;
  initialZoom?: WithDefault<Double, 3>;
  initialHeading?: WithDefault<Double, 0>;
  initialPitch?: WithDefault<Double, 0>;
  onMapReady?: DirectEventHandler<
    Readonly<{
      ready: boolean;
      capabilitiesJSON: string;
      styleRevision: Double;
    }>
  >;
  onMapError?: DirectEventHandler<Readonly<{ code: string; message: string }>>;
  onCameraIdle?: DirectEventHandler<
    Readonly<{
      latitude: Double;
      longitude: Double;
      zoom: Double;
      heading: Double;
      pitch: Double;
      origin: string;
    }>
  >;
  onFeaturePress?: DirectEventHandler<
    Readonly<{
      sourceId: string;
      featureId: string;
      layerId: string;
      propertiesJSON: string;
      indexRevision: Double;
      styleRevision: Double;
      latitude: Double;
      longitude: Double;
      x: Double;
      y: Double;
    }>
  >;
}
type MapHost = HostComponent<NativeProps>;
interface NativeCommands {
  queryMap: (
    viewRef: React.ElementRef<MapHost>,
    requestId: Double,
    requestJSON: string,
  ) => void;
  animateCamera: (
    viewRef: React.ElementRef<MapHost>,
    latitude: Double,
    longitude: Double,
    zoom: Double,
    heading: Double,
    pitch: Double,
    durationMs: Double,
  ) => void;
}
export const Commands = codegenNativeCommands<NativeCommands>({
  supportedCommands: ['animateCamera', 'queryMap'],
});
export default codegenNativeComponent<NativeProps>(
  'EnhancedMapLibreView',
) as MapHost;
