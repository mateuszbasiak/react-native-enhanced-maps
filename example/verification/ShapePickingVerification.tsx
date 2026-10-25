import React, { useEffect, useRef, useState } from 'react';
import {
  Button,
  Dimensions,
  Platform,
  StatusBar,
  Text,
  View,
} from 'react-native';
import { MapView, Polygon } from 'react-native-enhanced-maps';
import type { Coordinate, MapViewRef } from 'react-native-enhanced-maps';
const outer = [
  { latitude: -2, longitude: -2 },
  { latitude: -2, longitude: 2 },
  { latitude: 2, longitude: 2 },
  { latitude: 2, longitude: -2 },
];
const holes = [
  [
    { latitude: -1, longitude: -1 },
    { latitude: 1, longitude: -1 },
    { latitude: 1, longitude: 1 },
    { latitude: -1, longitude: 1 },
  ],
];
const lower = [
  { latitude: -1.5, longitude: -1.5 },
  { latitude: -1.5, longitude: 1.5 },
  { latitude: 1.5, longitude: 1.5 },
  { latitude: 1.5, longitude: -1.5 },
];
type Configuration = { underlay: boolean; top: boolean; outline: boolean };
type Result = {
  count: number;
  identifier: string;
  coordinate: Coordinate | null;
};
type Frame = { x: number; y: number; width: number; height: number };
type DebugGlobal = typeof globalThis & {
  __enhancedMapsShapePicking?: {
    snapshot(): {
      ready: boolean;
      configuration: Configuration;
      result: Result;
      frame: Frame;
      error: string;
    };
    configure(value: Partial<Configuration>): void;
    target(coordinate: Coordinate): Promise<{ x: number; y: number }>;
    remount(): void;
  };
};
export default function ShapePickingVerification() {
  const map = useRef<MapViewRef>(null),
    host = useRef<View>(null);
  const frame = useRef<Frame>({ x: 0, y: 0, width: 0, height: 0 });
  const [ready, setReady] = useState(false),
    [error, setError] = useState('');
  const [generation, setGeneration] = useState(0);
  const [configuration, setConfiguration] = useState<Configuration>({
    underlay: true,
    top: true,
    outline: false,
  });
  const [result, setResult] = useState<Result>({
    count: 0,
    identifier: 'none',
    coordinate: null,
  });
  const record = (identifier: string, coordinate: Coordinate) =>
    setResult((old) => ({ count: old.count + 1, identifier, coordinate }));
  const remount = () => {
    setReady(false);
    setGeneration((value) => value + 1);
  };
  useEffect(() => {
    if (!__DEV__) return;
    const target = globalThis as DebugGlobal;
    const api = {
      snapshot: () => ({
        ready,
        configuration,
        result,
        frame: frame.current,
        error,
      }),
      configure: (value: Partial<Configuration>) => {
        for (const [key, enabled] of Object.entries(value)) {
          if (
            !['underlay', 'top', 'outline'].includes(key) ||
            typeof enabled !== 'boolean'
          )
            throw new Error('Invalid shape-picking configuration');
        }
        setConfiguration((old) => ({ ...old, ...value }));
      },
      target: async (coordinate: Coordinate) => {
        if (!ready || !map.current) throw new Error('Map is not ready');
        const point = await map.current.pointForCoordinate(coordinate);
        const screen = Dimensions.get('screen');
        return {
          x: (frame.current.x + point.x) / screen.width,
          // Android measureInWindow excludes the status bar; Argent uses the full screen.
          y:
            (frame.current.y +
              point.y +
              (Platform.OS === 'android'
                ? (StatusBar.currentHeight ?? 0)
                : 0)) /
            screen.height,
        };
      },
      remount,
    };
    target.__enhancedMapsShapePicking = api;
    return () => {
      if (target.__enhancedMapsShapePicking === api)
        delete target.__enhancedMapsShapePicking;
    };
  }, [ready, configuration, result, error]);
  return (
    <View style={{ flex: 1 }}>
      <Text testID="shape-picking-status">
        {ready ? 'Ready' : 'Loading'} · {result.identifier} · presses{' '}
        {result.count}
        {error ? ` · ${error}` : ''}
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        <Button
          title={`Underlay ${configuration.underlay ? 'on' : 'off'}`}
          onPress={() =>
            setConfiguration((old) => ({ ...old, underlay: !old.underlay }))
          }
        />
        <Button
          title={`Top ${configuration.top ? 'on' : 'off'}`}
          onPress={() => setConfiguration((old) => ({ ...old, top: !old.top }))}
        />
        <Button
          title={`Outline ${configuration.outline ? 'on' : 'off'}`}
          onPress={() =>
            setConfiguration((old) => ({ ...old, outline: !old.outline }))
          }
        />
        <Button title="Remount" onPress={remount} />
      </View>
      <View
        ref={host}
        style={{ flex: 1 }}
        onLayout={() =>
          host.current?.measureInWindow((x, y, width, height) => {
            frame.current = { x, y, width, height };
          })
        }
      >
        <MapView
          key={generation}
          ref={map}
          style={{ flex: 1 }}
          styleURL="https://tiles.openfreemap.org/styles/liberty"
          initialCamera={{
            center: { latitude: 0, longitude: 0 },
            zoom: 4,
            heading: 0,
            pitch: 0,
          }}
          onMapReady={() => setReady(true)}
          onError={(event) => setError(event.code)}
          onPress={(event) => record('map', event.coordinate)}
        >
          {configuration.underlay && (
            <Polygon
              id="lower"
              coordinates={lower}
              fillColor="#145e9980"
              strokeWidth={0}
              zIndex={0}
              tappable
              onPress={(event) => record('lower', event.nativeEvent.coordinate)}
            />
          )}
          <Polygon
            id="top"
            coordinates={outer}
            holes={holes}
            visible={configuration.top}
            fillColor="#ef427480"
            strokeColor="#ef4274"
            strokeWidth={configuration.outline ? 12 : 0}
            zIndex={10}
            tappable
            onPress={(event) => record('top', event.nativeEvent.coordinate)}
          />
        </MapView>
      </View>
      <Text>
        The pink polygon has a square hole. Tap through to the blue underlay, or
        to the map when the underlay is off. Outlines remain selectable.
      </Text>
    </View>
  );
}
