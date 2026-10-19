import type { HostComponent, ViewProps } from 'react-native';
import type { DirectEventHandler, Double, WithDefault } from 'react-native/Libraries/Types/CodegenTypes';
import codegenNativeComponent from 'react-native/Libraries/Utilities/codegenNativeComponent';
import codegenNativeCommands from 'react-native/Libraries/Utilities/codegenNativeCommands';

export interface NativeProps extends ViewProps {
  rasterOverlay?: WithDefault<string, ''>;
  cameraIdleEventsEnabled?: WithDefault<boolean, false>;
  cameraEventsEnabled?: WithDefault<boolean, false>;
  cameraEventIntervalMs?: WithDefault<Double, 100>;
  provider?: WithDefault<string, 'apple'>;
  initialLatitude?: WithDefault<Double, 0>;
  initialLongitude?: WithDefault<Double, 0>;
  initialZoom?: WithDefault<Double, 3>;
  initialHeading?: WithDefault<Double, 0>;
  initialPitch?: WithDefault<Double, 0>;
  onMapReady?: DirectEventHandler<Readonly<{ provider: string }>>;
  onMapError?: DirectEventHandler<Readonly<{ code: string; message: string }>>;
  onCameraIdle?: DirectEventHandler<Readonly<{
    latitude: Double; longitude: Double; zoom: Double;
    heading: Double; pitch: Double; origin: string;
  }>>;
  onCameraChange?: DirectEventHandler<Readonly<{
    latitude: Double; longitude: Double; zoom: Double;
    heading: Double; pitch: Double; origin: string;
  }>>;
}
type MapHost = HostComponent<NativeProps>;
interface NativeCommands {
  animateCamera: (
    viewRef: React.ElementRef<MapHost>,
    latitude: Double, longitude: Double, zoom: Double,
    heading: Double, pitch: Double, durationMs: Double,
  ) => void;
}
export const Commands = codegenNativeCommands<NativeCommands>({ supportedCommands: ['animateCamera'] });
export default codegenNativeComponent<NativeProps>('EnhancedMapView') as MapHost;
