import React, { useEffect, useRef, useState } from 'react';
import { Platform, Text, View } from 'react-native';
import {
  MapView,
  Geojson,
  Heatmap,
  Overlay,
  WMSTile,
  LocalTile,
} from 'react-native-maplibre-maps';
import type { MapViewRef } from 'react-native-maplibre-maps';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const overlayAsset = require('../maplibre/vessel.png');
const base =
  Platform.OS === 'android' ? 'http://10.0.2.2:8102' : 'http://127.0.0.1:8102';
const initial = {
  mode: 'geojson',
  imageURI: '',
  latitudeOffset: 0,
  asset: false,
  bearing: 0,
  opacity: 1,
  present: true,
  variant: 0,
  path: '/tmp/rendering-tiles/{z}/{x}/{y}.png',
};
type Options = typeof initial;
export default function RenderingVerification() {
  const map = useRef<MapViewRef>(null),
    evidence = useRef({
      ready: 0,
      errors: [] as string[],
      presses: [] as string[],
    });
  const [options, setOptions] = useState(initial),
    [generation, setGeneration] = useState(0),
    [epoch, setEpoch] = useState(0);
  const latest = useRef(options);
  latest.current = options;
  useEffect(() => {
    if (!__DEV__) return;
    const target = globalThis as typeof globalThis & {
      __enhancedMapsRendering?: unknown;
    };
    const api = {
      snapshot: () => ({ ...evidence.current, options: latest.current }),
      configure: (next: Partial<Options>) =>
        setOptions((old) => ({ ...old, ...next })),
      remount: () => setGeneration((old) => old + 1),
      reloadStyle: () => setEpoch((old) => old + 1),
      fit: () => map.current?.fitElements({ durationMs: 0, padding: 20 }),
      cameraState: () => map.current?.getCamera(),
      project: (latitude: number, longitude: number) =>
        map.current?.pointForCoordinate({ latitude, longitude }),
      camera: (heading: number, pitch: number) =>
        map.current?.animateCamera({ heading, pitch }, 0),
    };
    target.__enhancedMapsRendering = api;
    return () => {
      if (target.__enhancedMapsRendering === api)
        delete target.__enhancedMapsRendering;
    };
  }, []);
  const press = (type: string) => {
    evidence.current.presses.push(type);
  };
  return (
    <View style={{ flex: 1 }}>
      <Text testID="rendering-status">RN Maps rendering: {options.mode}</Text>
      <MapView
        ref={map}
        key={generation}
        style={{ flex: 1 }}
        styleURL={`${base}/style.json?epoch=${epoch}`}
        initialCamera={{
          center: { latitude: 0, longitude: 0 },
          zoom: 3,
          heading: 0,
          pitch: 0,
        }}
        onMapReady={() => {
          evidence.current.ready++;
        }}
        onError={(error) =>
          evidence.current.errors.push(`${error.code}: ${error.message}`)
        }
        onPress={() => press('map')}
      >
        {options.present && options.mode === 'geojson' && (
          <Geojson
            tappable
            onPress={(event) =>
              press(`geojson:${event.type}:${event.feature.properties?.name}`)
            }
            markerComponent={
              <Text style={{ backgroundColor: 'white', padding: 6 }}>
                Geojson point
              </Text>
            }
            geojson={{
              type: 'FeatureCollection',
              features: [
                {
                  type: 'Feature',
                  properties: { name: 'point' },
                  geometry: { type: 'Point', coordinates: [8, 0] },
                },
                {
                  type: 'Feature',
                  properties: {
                    name: 'polygon',
                    fill: options.variant ? 'blue' : 'red',
                  },
                  geometry: {
                    type: 'Polygon',
                    coordinates: [
                      [
                        [-8, -4],
                        [-2, -4],
                        [-2, 4],
                        [-8, 4],
                        [-8, -4],
                      ],
                      [
                        [-6, -1],
                        [-4, -1],
                        [-4, 1],
                        [-6, 1],
                        [-6, -1],
                      ],
                    ],
                  },
                },
              ],
            }}
          />
        )}
        {options.present && options.mode === 'heatmap' && (
          <Heatmap
            radius={40}
            opacity={options.opacity}
            points={[
              { latitude: 0, longitude: 0, weight: options.variant ? 0 : 2 },
            ]}
            gradient={{ colors: ['transparent', 'red'], startPoints: [0, 1] }}
          />
        )}
        {options.present && options.mode === 'overlay' && (
          <Overlay
            image={
              options.asset
                ? overlayAsset
                : {
                    uri:
                      options.imageURI ||
                      `${base}/image.png?variant=${options.variant}`,
                  }
            }
            bounds={[
              [5 + options.latitudeOffset, 8],
              [-5 + options.latitudeOffset, -8],
            ]}
            bearing={options.bearing}
            opacity={options.opacity}
            tappable
            onPress={() => press('overlay')}
          />
        )}
        {options.present && options.mode === 'wms' && (
          <WMSTile
            urlTemplate={`${base}/wms?bbox={minX},{minY},{maxX},{maxY}&width={width}&height={height}&variant=${options.variant}`}
          />
        )}
        {options.present && options.mode === 'local' && (
          <LocalTile pathTemplate={options.path} />
        )}
      </MapView>
    </View>
  );
}
