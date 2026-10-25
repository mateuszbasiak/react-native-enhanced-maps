import React, { useEffect, useRef, useState } from 'react';
import {
  Button,
  Dimensions,
  Platform,
  StatusBar,
  Text,
  View,
} from 'react-native';
import { MapView, Polyline } from 'react-native-enhanced-maps';
import type {
  Coordinate,
  MapViewRef,
  ShapePressEvent,
} from 'react-native-enhanced-maps';
const flat = [
  { latitude: 0, longitude: -12 },
  { latitude: 0, longitude: -4 },
  { latitude: 0, longitude: 12 },
];
const curved = [
  { latitude: 30, longitude: -20 },
  { latitude: 55, longitude: 0 },
  { latitude: 30, longitude: 40 },
];
const dashed = [
  { latitude: -6, longitude: -12 },
  { latitude: -6, longitude: 12 },
];
const palettes = [
  ['red', 'lime', 'blue'],
  ['yellow', 'magenta', 'cyan'],
] as const;
const cameras = [
  { center: { latitude: 0, longitude: 0 }, zoom: 3, heading: 0, pitch: 0 },
  { center: { latitude: 43, longitude: 10 }, zoom: 2, heading: 0, pitch: 0 },
];
type Configuration = {
  gradient: boolean;
  geodesic: boolean;
  alternate: boolean;
};
type Frame = { x: number; y: number; width: number; height: number };
type DebugGlobal = typeof globalThis & {
  __enhancedMapsGradient?: {
    snapshot(): {
      ready: boolean;
      configuration: Configuration;
      presses: number;
      selection: string;
      error: string;
      frame: Frame;
    };
    configure(value: Partial<Configuration>): void;
    target(coordinate: Coordinate): Promise<{ x: number; y: number }>;
    remount(): void;
  };
};
export default function GradientVerification() {
  const map = useRef<MapViewRef>(null),
    host = useRef<View>(null);
  const frame = useRef<Frame>({ x: 0, y: 0, width: 0, height: 0 });
  const [ready, setReady] = useState(false),
    [error, setError] = useState('');
  const [generation, setGeneration] = useState(0);
  const [configuration, setConfiguration] = useState<Configuration>({
    gradient: true,
    geodesic: false,
    alternate: false,
  });
  const [presses, setPresses] = useState(0),
    [selection, setSelection] = useState('none');
  const remount = () => {
    setReady(false);
    setError('');
    setGeneration((v) => v + 1);
  };
  useEffect(() => {
    if (ready)
      map.current?.animateCamera(cameras[configuration.geodesic ? 1 : 0]!, 0);
  }, [ready, configuration.geodesic]);
  useEffect(() => {
    if (!__DEV__) return;
    const target = globalThis as DebugGlobal;
    const api = {
      snapshot: () => ({
        ready,
        configuration,
        presses,
        selection,
        error,
        frame: frame.current,
      }),
      configure: (value: Partial<Configuration>) => {
        for (const [key, enabled] of Object.entries(value))
          if (
            !['gradient', 'geodesic', 'alternate'].includes(key) ||
            typeof enabled !== 'boolean'
          )
            throw new Error('Invalid gradient configuration');
        setConfiguration((old) => ({ ...old, ...value }));
      },
      target: async (coordinate: Coordinate) => {
        if (!ready || !map.current) throw new Error('Map is not ready');
        const point = await map.current.pointForCoordinate(coordinate),
          screen = Dimensions.get('screen');
        return {
          x: (frame.current.x + point.x) / screen.width,
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
    target.__enhancedMapsGradient = api;
    return () => {
      if (target.__enhancedMapsGradient === api)
        delete target.__enhancedMapsGradient;
    };
  }, [ready, configuration, presses, selection, error]);
  const select = (event: ShapePressEvent) => {
    setPresses((v) => v + 1);
    setSelection(event.nativeEvent.identifier);
  };
  return (
    <View style={{ flex: 1 }}>
      <Text testID="gradient-status">
        {ready ? 'Ready' : 'Loading'} · {selection} · presses {presses}
        {error ? ` · ${error}` : ''}
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        <Button
          title={configuration.gradient ? 'Gradient on' : 'Gradient off'}
          onPress={() =>
            setConfiguration((old) => ({ ...old, gradient: !old.gradient }))
          }
        />
        <Button
          title="Swap colors"
          onPress={() =>
            setConfiguration((old) => ({ ...old, alternate: !old.alternate }))
          }
        />
        <Button
          title={configuration.geodesic ? 'Geodesic on' : 'Geodesic off'}
          onPress={() =>
            setConfiguration((old) => ({ ...old, geodesic: !old.geodesic }))
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
          styleURL="https://demotiles.maplibre.org/style.json"
          initialCamera={cameras[configuration.geodesic ? 1 : 0]}
          onMapReady={() => setReady(true)}
          onError={(e) => setError(e.code + ': ' + e.message)}
        >
          <Polyline
            id="gradient-route"
            coordinates={configuration.geodesic ? curved : flat}
            geodesic={configuration.geodesic}
            strokeColor="#ff8800"
            strokeColors={
              configuration.gradient
                ? palettes[configuration.alternate ? 1 : 0]
                : undefined
            }
            strokeWidth={14}
            tappable
            onPress={select}
          />
          <Polyline
            id="dash-reference"
            coordinates={dashed}
            strokeColor="#145e99"
            strokeWidth={4}
            lineDashPattern={[8, 4]}
            tappable
            onPress={select}
          />
        </MapView>
      </View>
      <Text>
        Colors follow the original vertices. Swap the palette, toggle a solid
        stroke, or compare geodesic geometry. Dashed reference stays separate.
      </Text>
    </View>
  );
}
