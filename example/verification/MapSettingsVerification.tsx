import React, { useEffect, useRef, useState } from 'react';
import { Button, Text, View } from 'react-native';
import { MapView } from 'react-native-enhanced-maps';
import type {
  Camera,
  CameraEvent,
  MapSettings,
  MapBounds,
  MapPadding,
  Coordinate,
  MapPoint,
  FitOptions,
  MapViewRef,
} from 'react-native-enhanced-maps';

const camera: Camera = {
  center: { latitude: 54.37, longitude: 18.66 },
  zoom: 10,
  heading: 45,
  pitch: 40,
};
const initial = {
  scrollEnabled: true,
  zoomEnabled: true,
  rotateEnabled: true,
  pitchEnabled: true,
  showsCompass: true,
  minZoomLevel: 0,
  maxZoomLevel: 24,
};
type Evidence = {
  ready: number;
  camera: CameraEvent | null;
  errors: string[];
  size: { width: number; height: number };
};
type DebugGlobal = typeof globalThis & {
  __enhancedMapsSettings?: {
    snapshot(): Evidence;
    configure(settings: MapSettings): void;
    resize(height: number | null): void;
    animate(zoom: number): void;
    bounds(): Promise<MapBounds> | undefined;
    project(coordinate: Coordinate): Promise<MapPoint> | undefined;
    fit(
      coordinates: readonly Coordinate[],
      options?: FitOptions,
    ): Promise<void> | undefined;
  };
};
export default function MapSettingsVerification() {
  const map = useRef<MapViewRef>(null);
  const evidence = useRef<Evidence>({
    ready: 0,
    camera: null,
    errors: [],
    size: { width: 0, height: 0 },
  });
  const [settings, setSettings] = useState<MapSettings>(initial);
  const [status, setStatus] = useState('Waiting for map');
  const [height, setHeight] = useState<number | null>(null);
  useEffect(() => {
    if (!__DEV__) return;
    const target = globalThis as DebugGlobal;
    const api = {
      snapshot: () => evidence.current,
      configure: setSettings,
      resize: setHeight,
      bounds: () => map.current?.getVisibleBounds(),
      project: (coordinate: Coordinate) =>
        map.current?.pointForCoordinate(coordinate),
      fit: (coordinates: readonly Coordinate[], options?: FitOptions) =>
        map.current?.fitCoordinates(coordinates, options),
      animate: (zoom: number) =>
        map.current?.animateCamera({ ...camera, zoom }, 0),
    };
    target.__enhancedMapsSettings = api;
    return () => {
      if (target.__enhancedMapsSettings === api)
        delete target.__enhancedMapsSettings;
    };
  }, []);
  return (
    <View style={{ flex: 1 }}>
      <Text testID="settings-status">{status}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {(
          [
            'scrollEnabled',
            'zoomEnabled',
            'rotateEnabled',
            'pitchEnabled',
            'showsCompass',
          ] as const
        ).map((name) => (
          <Button
            key={name}
            title={`${name}: ${settings[name] === false ? 'off' : 'on'}`}
            onPress={() =>
              setSettings((value) => ({
                ...value,
                [name]: value[name] === false,
              }))
            }
          />
        ))}
        <Button
          title="Zoom range 10–12"
          onPress={() =>
            setSettings((v) => ({ ...v, minZoomLevel: 10, maxZoomLevel: 12 }))
          }
        />
        <Button
          title="Zoom range 2–4"
          onPress={() =>
            setSettings((v) => ({ ...v, minZoomLevel: 2, maxZoomLevel: 4 }))
          }
        />
        <Button
          title="Request zoom 20"
          onPress={() => map.current?.animateCamera({ ...camera, zoom: 20 }, 0)}
        />
        <Button
          title="Request zoom 1"
          onPress={() => map.current?.animateCamera({ ...camera, zoom: 1 }, 0)}
        />
        <Button
          title="Asymmetric padding"
          onPress={() =>
            setSettings((v) => ({
              ...v,
              mapPadding: {
                top: 40,
                right: 20,
                bottom: 30,
                left: 60,
              } satisfies MapPadding,
            }))
          }
        />
        <Button
          title="Clear padding"
          onPress={() => setSettings((v) => ({ ...v, mapPadding: 0 }))}
        />
        <Button
          title="Invalid viewport padding"
          onPress={() => setSettings((v) => ({ ...v, mapPadding: 10000 }))}
        />
        <Button title="Reset settings" onPress={() => setSettings(initial)} />
      </View>
      <View
        style={height === null ? { flex: 1 } : { height }}
        onLayout={({ nativeEvent }) => {
          evidence.current.size = {
            width: nativeEvent.layout.width,
            height: nativeEvent.layout.height,
          };
        }}
      >
        <MapView
          ref={map}
          {...settings}
          style={{ flex: 1 }}
          initialCamera={camera}
          styleURL="https://tiles.openfreemap.org/styles/liberty"
          onMapReady={() => {
            evidence.current.ready++;
            setStatus('Ready');
          }}
          onCameraIdle={(event) => {
            evidence.current.camera = event;
            setStatus(`Zoom ${event.camera.zoom.toFixed(3)} · ${event.origin}`);
          }}
          onError={(error) => {
            evidence.current.errors.push(error.message);
            evidence.current.errors = evidence.current.errors.slice(-32);
            setStatus(error.message);
          }}
        />
      </View>
    </View>
  );
}
