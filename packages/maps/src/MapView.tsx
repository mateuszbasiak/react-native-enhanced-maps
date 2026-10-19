import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import type { ElementRef } from 'react';
import { Platform } from 'react-native';
import NativeMapView, { Commands } from './specs/MapViewNativeComponent';
import { classifyMapError, resolveProvider, validateCamera } from './contracts';
import type { Camera, CameraOrigin, MapViewProps, MapViewRef } from './types';

const defaultCamera: Camera = { center: { latitude: 0, longitude: 0 }, zoom: 3, heading: 0, pitch: 0 };
export const MapView = forwardRef<MapViewRef, MapViewProps>(function MapView(props, ref) {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') throw new Error('Enhanced maps supports iOS and Android only');
  const provider = resolveProvider(Platform.OS, props.provider);
  const nativeRef = useRef<ElementRef<typeof NativeMapView>>(null);
  const ready = useRef(false);
  // An initial camera is deliberately mount-only. Controlled camera semantics are deferred.
  const [initial] = useState(() => validateCamera(props.initialCamera ?? defaultCamera));
  useImperativeHandle(ref, () => ({
    animateCamera(camera, durationMs = 300) {
      validateCamera(camera);
      if (!Number.isFinite(durationMs) || durationMs < 0) throw new RangeError('durationMs must be finite and non-negative');
      if (!nativeRef.current || !ready.current) throw new Error('Map is not ready');
      Commands.animateCamera(nativeRef.current, camera.center.latitude, camera.center.longitude, camera.zoom, camera.heading, camera.pitch, durationMs);
    },
  }), []);
  return <NativeMapView
    ref={nativeRef}
    style={props.style}
    testID={props.testID}
    provider={provider}
    initialLatitude={initial.center.latitude}
    initialLongitude={initial.center.longitude}
    initialZoom={initial.zoom}
    initialHeading={initial.heading}
    initialPitch={initial.pitch}
    onMapReady={() => { ready.current = true; props.onMapReady?.(); }}
    onMapError={({ nativeEvent }) => {
      const error = classifyMapError(nativeEvent);
      if (error.fatal) ready.current = false;
      props.onError?.(error);
    }}
    onCameraChange={({ nativeEvent: e }) => {
      const origins: readonly string[] = ['gesture', 'application', 'sdk'];
      props.onCameraChange?.({ camera: { center: { latitude: e.latitude, longitude: e.longitude }, zoom: e.zoom, heading: e.heading, pitch: e.pitch }, origin: (origins.includes(e.origin) ? e.origin : 'unknown') as CameraOrigin });
    }}
  />;
});
