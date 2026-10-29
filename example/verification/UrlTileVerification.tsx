import React, { useEffect, useRef, useState } from 'react';
import { Platform, Text, View } from 'react-native';
import { Circle, MapView, UrlTile } from 'react-native-maplibre-maps';
import type {
  Camera,
  CameraEvent,
  MapViewRef,
} from 'react-native-maplibre-maps';

const origin = { latitude: 0, longitude: 0 };
const base =
  Platform.OS === 'android' ? 'http://10.0.2.2:8099' : 'http://127.0.0.1:8099';
const initial = {
  present: true,
  visible: true,
  opacity: 1,
  variant: 'red' as 'red' | 'blue',
  shape: false,
  aboveShape: false,
  tileSize: 256,
  flipY: false,
  minimumZ: 0,
  maximumZ: 22,
};
type Options = typeof initial;
type Evidence = { ready: number; errors: string[]; camera: CameraEvent | null };
type Api = {
  snapshot(): Evidence & { options: Options };
  configure(options: Partial<Options>): void;
  animate(zoom: number): void;
  camera(camera: Camera): Promise<void>;
  reloadStyle(): void;
  remount(): void;
  fit(): Promise<void>;
};
export default function UrlTileVerification() {
  const map = useRef<MapViewRef>(null);
  const evidence = useRef<Evidence>({ ready: 0, errors: [], camera: null });
  const [options, setOptions] = useState(initial);
  const latest = useRef(options);
  useEffect(() => {
    latest.current = options;
  }, [options]);
  const [generation, setGeneration] = useState(0),
    [epoch, setEpoch] = useState(0);
  useEffect(() => {
    if (!__DEV__) return;
    const target = globalThis as typeof globalThis & {
      __enhancedMapsUrlTiles?: Api;
    };
    const api: Api = {
      snapshot: () => ({ ...evidence.current, options: latest.current }),
      configure: (next) => setOptions((old) => ({ ...old, ...next })),
      camera: async (camera) => {
        if (!map.current) throw new Error('Map missing');
        await map.current.setCamera(camera);
      },
      animate: (zoom) => {
        void map.current?.animateCamera(
          { center: origin, zoom, heading: 0, pitch: 0 },
          0,
        );
      },
      reloadStyle: () => setEpoch((old) => old + 1),
      remount: () => setGeneration((old) => old + 1),
      fit: () => {
        if (!map.current) return Promise.reject(new Error('Map unavailable'));
        return map.current.fitElements({ durationMs: 0, padding: 20 });
      },
    };
    target.__enhancedMapsUrlTiles = api;
    return () => {
      if (target.__enhancedMapsUrlTiles === api)
        delete target.__enhancedMapsUrlTiles;
    };
  }, []);
  return (
    <View style={{ flex: 1 }}>
      <Text>Local XYZ tiles — {options.variant}</Text>
      <MapView
        key={generation}
        ref={map}
        style={{ flex: 1 }}
        styleURL={`${base}/style.json?epoch=${epoch}`}
        initialCamera={{ center: origin, zoom: 2, heading: 0, pitch: 0 }}
        onMapReady={() => {
          evidence.current.ready++;
        }}
        onCameraIdle={(camera) => {
          evidence.current.camera = camera;
        }}
        onError={(error) => {
          evidence.current.errors.push(error.message);
        }}
      >
        {options.present && (
          <UrlTile
            id="em-marker-clusters:tiles"
            urlTemplate={`${base}/${options.variant}/{z}/{x}/{y}.png`}
            tileSize={options.tileSize}
            flipY={options.flipY}
            minimumZ={options.minimumZ}
            maximumZ={options.maximumZ}
            opacity={options.opacity}
            visible={options.visible}
            zIndex={options.aboveShape ? 2 : 0}
          />
        )}
        {options.shape && (
          <Circle
            id="fixture-shape"
            center={origin}
            radius={300000}
            fillColor="#00ff00"
            strokeColor="#00ff00"
            zIndex={1}
          />
        )}
      </MapView>
    </View>
  );
}
