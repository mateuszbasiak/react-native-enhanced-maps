import React, { useEffect, useRef, useState } from 'react';
import { Button, Text, View } from 'react-native';
import { Circle, MapView, Polygon, Polyline } from 'react-native-maplibre-maps';
import type { Coordinate, MapViewRef } from 'react-native-maplibre-maps';

const modes = ['circle', 'geodesic', 'polygon'] as const;
type Mode = (typeof modes)[number];
const center = { latitude: 0, longitude: 179.9 };
const route = [
  { latitude: 0, longitude: 179 },
  { latitude: 0, longitude: -179 },
];
const ring = [
  { latitude: -1, longitude: 179 },
  { latitude: -1, longitude: -179 },
  { latitude: 1, longitude: -179 },
  { latitude: 1, longitude: 179 },
];
const samples: Record<Mode, Coordinate[]> = {
  circle: [
    center,
    { latitude: 0.269, longitude: 179.9 },
    { latitude: -0.269, longitude: 179.9 },
    { latitude: 0, longitude: -179.831 },
    { latitude: 0, longitude: 179.631 },
  ],
  geodesic: route,
  polygon: ring,
};
type Evidence = {
  ready: boolean;
  status: string;
  checks: {
    mode: Mode;
    points: { x: number; y: number }[];
    longitude: number;
    zoom: number;
  }[];
  error: string;
};
type DebugGlobal = typeof globalThis & {
  __enhancedMapsFit?: { snapshot(): Evidence; run(): Promise<void> };
};
/** Public component/ref acceptance; fits generated geometry across the dateline. */
export default function FitVerification() {
  const map = useRef<MapViewRef>(null);
  const evidence = useRef<Evidence>({
    ready: false,
    status: 'idle',
    checks: [],
    error: '',
  });
  const dimensions = useRef({ width: 0, height: 0 });
  const alive = useRef(true),
    running = useRef(false);
  const [mode, setMode] = useState<Mode>('circle');
  const [status, setStatus] = useState('Loading');
  const run = useRef(async () => {});
  run.current = async () => {
    if (running.current || !map.current || !evidence.current.ready)
      throw new Error('Fit fixture is not ready');
    running.current = true;
    evidence.current = {
      ready: true,
      status: 'running',
      checks: [],
      error: '',
    };
    try {
      for (const next of modes) {
        setMode(next);
        setStatus(`Checking ${next}`);
        // Allow the public component update to cross Fabric before querying the accepted scene.
        await new Promise<void>((resolve) => setTimeout(resolve, 500));
        if (!alive.current || !map.current)
          throw new Error('Fit fixture disposed');
        await map.current.fitElements({ padding: 40, durationMs: 0 });
        const camera = await map.current.getCamera();
        const points = await Promise.all(
          samples[next].map((coordinate) =>
            map.current!.pointForCoordinate(coordinate),
          ),
        );
        const { width, height } = dimensions.current;
        if (
          points.some(
            (point) =>
              !Number.isFinite(point.x) ||
              !Number.isFinite(point.y) ||
              point.x < 38 ||
              point.x > width - 38 ||
              point.y < 38 ||
              point.y > height - 38,
          )
        )
          throw new Error(`${next} was not fitted inside padding`);
        if (Math.abs(camera.center.longitude) < 175 || camera.zoom < 5)
          throw new Error(`${next} did not use the dateline arc`);
        evidence.current.checks.push({
          mode: next,
          points,
          longitude: camera.center.longitude,
          zoom: camera.zoom,
        });
      }
      // Explicit authoring remains geographic even though accepted source geometry is unwrapped.
      let rejected = false;
      try {
        await map.current!.fitCoordinates([{ latitude: 0, longitude: 181 }]);
      } catch {
        rejected = true;
      }
      if (!rejected) throw new Error('Invalid explicit longitude accepted');
      evidence.current.status = 'passed';
      setStatus('Passed 3 dateline fits · explicit bounds preserved');
    } catch (error) {
      evidence.current.status = 'failed';
      evidence.current.error = String(error);
      setStatus(String(error));
      throw error;
    } finally {
      running.current = false;
    }
  };
  useEffect(() => {
    alive.current = true;
    if (!__DEV__) return;
    const target = globalThis as DebugGlobal;
    const api = {
      snapshot: () => JSON.parse(JSON.stringify(evidence.current)) as Evidence,
      run: () => run.current(),
    };
    target.__enhancedMapsFit = api;
    return () => {
      alive.current = false;
      if (target.__enhancedMapsFit === api) delete target.__enhancedMapsFit;
    };
  }, []);
  return (
    <View style={{ flex: 1 }}>
      <Text testID="fit-status">{status}</Text>
      <Button
        title="Run dateline fits"
        onPress={() => {
          void run.current().catch(() => {});
        }}
      />
      <View
        style={{ flex: 1 }}
        onLayout={(event) => {
          dimensions.current = event.nativeEvent.layout;
        }}
      >
        <MapView
          ref={map}
          style={{ flex: 1 }}
          styleURL="https://tiles.openfreemap.org/styles/liberty"
          initialCamera={{ center, zoom: 4, heading: 0, pitch: 0 }}
          onMapReady={() => {
            evidence.current.ready = true;
            setStatus('Ready');
          }}
          onError={(event) => {
            evidence.current.error = event.message;
          }}
        >
          {mode === 'circle' ? (
            <Circle center={center} radius={30000} fillColor="#e53935" />
          ) : mode === 'geodesic' ? (
            <Polyline
              coordinates={route}
              geodesic
              strokeColor="#e53935"
              strokeWidth={5}
            />
          ) : (
            <Polygon coordinates={ring} fillColor="#e53935" />
          )}
        </MapView>
      </View>
    </View>
  );
}
