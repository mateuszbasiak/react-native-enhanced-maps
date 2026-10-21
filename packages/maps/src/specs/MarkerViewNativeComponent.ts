import type { HostComponent, ViewProps } from 'react-native';
import type {
  Double,
  WithDefault,
} from 'react-native/Libraries/Types/CodegenTypes';
import codegenNativeComponent from 'react-native/Libraries/Utilities/codegenNativeComponent';
export interface NativeProps extends ViewProps {
  markerID?: WithDefault<string, ''>;
  latitude?: WithDefault<Double, 0>;
  longitude?: WithDefault<Double, 0>;
  markerZIndex?: WithDefault<Double, 0>;
  anchorX?: WithDefault<Double, 0.5>;
  anchorY?: WithDefault<Double, 1>;
  offsetX?: WithDefault<Double, 0>;
  offsetY?: WithDefault<Double, 0>;
}
export default codegenNativeComponent<NativeProps>(
  'EnhancedMarkerView',
) as HostComponent<NativeProps>;
