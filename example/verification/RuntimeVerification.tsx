import ExampleControls from '../ExampleControls';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Button,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MapView, Circle, Marker } from 'react-native-enhanced-maps';
import type {
  CameraEvent,
  MapCapabilities,
  MapError,
  MapGestureEvent,
  ShapePressEvent,
  MapPressEvent,
  MapPoint,
  MapBounds,
  Coordinate,
  MapViewRef,
} from 'react-native-enhanced-maps';

type Snapshot = {
  schemaVersion: 1;
  platform: string;
  gestures: MapGestureEvent[];
  subscriptionTransitions: { enabled: boolean; gestureCount: number }[];
  featureHits: ShapePressEvent[];
  legacyFeatureIds: string[];
  mapPresses: MapPressEvent[];
  markerPresses: number;
  markerLongPresses: number;
  geometryQueries: {
    input: Coordinate;
    point: MapPoint;
    coordinate: Coordinate;
    bounds: MapBounds;
  }[];
  queryErrors: string[];
  viewport: { width: number; height: number } | null;
  fitRuns: {
    kind: string;
    coordinates: Coordinate[];
    points: MapPoint[];
    bounds: MapBounds;
  }[];
  camera: CameraEvent[];
  capabilities: (MapCapabilities | null)[];
  errors: MapError[];
  readyCount: number;
};
type VerificationGlobal = typeof globalThis & {
  __enhancedMapsVerification?: {
    snapshot: () => Snapshot & {
      currentCapabilities: MapCapabilities | null;
      candidate: { revision: number; longitude: number };
      sourcePresent: boolean;
      gestureEnabled: boolean;
    };
  };
};
const initial = { revision: 1, longitude: 18.66 };
const append = <T,>(items: T[], value: T, limit: number) => {
  items.push(value);
  if (items.length > limit) items.shift();
};

/** Development-only, bounded runtime evidence; input actions still use the native UI. */
export default function RuntimeVerification() {
  const map = useRef<MapViewRef>(null);
  const evidence = useRef<Snapshot>({
    schemaVersion: 1,
    platform: Platform.OS,
    gestures: [],
    subscriptionTransitions: [],
    featureHits: [],
    legacyFeatureIds: [],
    mapPresses: [],
    markerPresses: 0,
    markerLongPresses: 0,
    geometryQueries: [],
    queryErrors: [],
    viewport: null,
    fitRuns: [],
    camera: [],
    capabilities: [],
    errors: [],
    readyCount: 0,
  });
  const [summary, setSummary] = useState('Waiting for map');
  const [enabled, setEnabled] = useState(true);
  const [cycling, setCycling] = useState(false);
  const subscriptionTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => subscriptionTimers.current.forEach(clearTimeout), []);
  const [pressEnabled, setPressEnabled] = useState(true);
  const [showMarker, setShowMarker] = useState(false);
  const [interval, setInterval] = useState(50);
  const [styleEpoch, setStyleEpoch] = useState(0);
  const [generation, setGeneration] = useState(0);
  const [compact, setCompact] = useState(false);
  const [present, setPresent] = useState(true);
  const [accepted, setAccepted] = useState(initial);
  const [candidate, setCandidate] = useState(initial);
  const fit = async (kind: string) => {
    try {
      const current = map.current;
      if (!current) throw new Error('Map is not mounted');
      const coordinates =
        kind === 'dateline'
          ? [
              { latitude: 10, longitude: 179 },
              { latitude: 12, longitude: -179 },
            ]
          : kind === 'elements'
            ? [
                ...(present
                  ? [{ latitude: 54.37, longitude: accepted.longitude }]
                  : []),
                ...(showMarker ? [{ latitude: 54.37, longitude: 18.66 }] : []),
              ]
            : [
                { latitude: 54.36, longitude: 18.64 },
                { latitude: 54.39, longitude: 18.69 },
                { latitude: 54.375, longitude: 18.66 },
              ];
      const options = {
        durationMs: kind === 'animated' ? 600 : 0,
        padding: { top: 20, right: 30, bottom: 40, left: 50 },
      };
      if (kind === 'elements') await current.fitElements(options);
      else await current.fitCoordinates(coordinates, options);
      if (options.durationMs)
        await new Promise<void>((resolve) =>
          setTimeout(resolve, options.durationMs + 3000),
        );
      const points = await Promise.all(
        coordinates.map((coordinate) => current.pointForCoordinate(coordinate)),
      );
      const viewport = evidence.current.viewport;
      if (
        viewport &&
        points.some(
          (point) =>
            point.x < 49.99 ||
            point.x > viewport.width - 29.99 ||
            point.y < 19.99 ||
            point.y > viewport.height - 39.99,
        )
      )
        throw new Error(
          `Fit projection is outside requested padding: ${JSON.stringify(points)}`,
        );
      const bounds = await current.getVisibleBounds();
      if (
        (kind === 'fixture' || kind === 'animated') &&
        bounds.north - bounds.south > 1
      )
        throw new Error('Local fit framing is excessively wide');
      append(
        evidence.current.fitRuns,
        { kind, coordinates, points, bounds },
        32,
      );
      setSummary(`Fit ${kind} accepted`);
    } catch (error) {
      append(evidence.current.queryErrors, String(error), 32);
      setSummary(`Fit failed: ${String(error)}`);
    }
  };
  const onGesture = useCallback((event: MapGestureEvent) => {
    append(evidence.current.gestures, event, 256);
    setSummary(
      `${event.kind} ${event.phase} #${event.id} · ${evidence.current.gestures.length} samples`,
    );
  }, []);
  useEffect(() => {
    if (!__DEV__) return;
    const target = globalThis as VerificationGlobal;
    const api = {
      snapshot: () => ({
        ...evidence.current,
        currentCapabilities: map.current?.getCapabilities() ?? null,
        candidate,
        sourcePresent: present,
        gestureEnabled: enabled,
      }),
    };
    target.__enhancedMapsVerification = api;
    return () => {
      if (target.__enhancedMapsVerification === api)
        delete target.__enhancedMapsVerification;
    };
  }, [candidate, present, enabled]);
  if (!__DEV__) return null;
  return (
    <View style={{ flex: 1 }}>
      <Text testID="verification-summary" style={styles.status}>
        {summary}
      </Text>
      <ExampleControls>
        <View style={styles.controls}>
          <Button
            title={enabled ? 'Disable gesture events' : 'Enable gesture events'}
            disabled={cycling}
            onPress={() => setEnabled((v) => !v)}
          />
          <Button
            title={`Interval ${interval}ms`}
            onPress={() => setInterval((v) => (v === 50 ? 250 : 50))}
          />
          <Button
            title={pressEnabled ? 'Disable map presses' : 'Enable map presses'}
            onPress={() => setPressEnabled((v) => !v)}
          />
          <Button
            title={showMarker ? 'Hide marker child' : 'Show marker child'}
            onPress={() => setShowMarker((v) => !v)}
          />
          <Button
            title="Query map geometry"
            onPress={async () => {
              try {
                const current = map.current;
                if (!current) throw new Error('Map is not mounted');
                const input = { latitude: 54.373, longitude: 18.664 };
                const point = await current.pointForCoordinate(input);
                const [coordinate, bounds] = await Promise.all([
                  current.coordinateForPoint(point),
                  current.getVisibleBounds(),
                ]);
                append(
                  evidence.current.geometryQueries,
                  { input, point, coordinate, bounds },
                  32,
                );
                setSummary(
                  `Geometry round trip ${evidence.current.geometryQueries.length}`,
                );
              } catch (error) {
                const message =
                  error instanceof Error ? error.message : 'Query failed';
                append(evidence.current.queryErrors, message, 32);
                setSummary(message);
              }
            }}
          />
          <Button
            title="Clear evidence"
            onPress={() => {
              evidence.current = {
                schemaVersion: 1,
                platform: Platform.OS,
                gestures: [],
                subscriptionTransitions: [],
                featureHits: [],
                legacyFeatureIds: [],
                mapPresses: [],
                markerPresses: 0,
                markerLongPresses: 0,
                geometryQueries: [],
                queryErrors: [],
                viewport: evidence.current.viewport,
                fitRuns: [],
                camera: [],
                capabilities: [],
                errors: [],
                readyCount: 0,
              };
              setSummary('Evidence cleared');
            }}
          />
          <Button title="Fit fixture" onPress={() => fit('fixture')} />
          <Button title="Fit elements" onPress={() => fit('elements')} />
          <Button title="Fit dateline" onPress={() => fit('dateline')} />
          <Button title="Fit animated" onPress={() => fit('animated')} />
          <Button
            title="Camera command"
            onPress={() =>
              map.current?.animateCamera(
                {
                  center: { latitude: 54.37, longitude: 18.66 },
                  zoom: 13,
                  heading: 45,
                  pitch: 35,
                },
                600,
              )
            }
          />
          <Button
            title="Long camera"
            onPress={() =>
              map.current?.animateCamera(
                {
                  center: { latitude: 54.4, longitude: 18.7 },
                  zoom: 15,
                  heading: 90,
                  pitch: 20,
                },
                10000,
              )
            }
          />
          <Button
            title="Instant camera"
            onPress={() =>
              map.current?.animateCamera(
                {
                  center: { latitude: 54.37, longitude: 18.66 },
                  zoom: 13,
                  heading: 45,
                  pitch: 35,
                },
                0,
              )
            }
          />
          <Button
            title="Repeat current camera"
            onPress={() => {
              const current = evidence.current.camera.at(-1)?.camera;
              if (current) map.current?.animateCamera(current, 0);
            }}
          />
          <Button
            title="Reload style"
            onPress={() => {
              setStyleEpoch((v) => v + 1);
              setSummary('Reloading style');
            }}
          />
          <Button
            title="Move shape"
            onPress={() => {
              const next = {
                revision: accepted.revision + 1,
                longitude: accepted.longitude === 18.66 ? 18.67 : 18.66,
              };
              setAccepted(next);
              setCandidate(next);
            }}
          />
          <Button
            title="Restore accepted"
            onPress={() => setCandidate(accepted)}
          />
          <Button
            title={present ? 'Remove shape' : 'Re-add shape'}
            onPress={() => {
              if (!present) {
                const next = { revision: 0, longitude: 18.66 };
                setAccepted(next);
                setCandidate(next);
              }
              setPresent((v) => !v);
            }}
          />
          <Button
            title="Remount verification map"
            onPress={() => {
              setCandidate(initial);
              setAccepted(initial);
              setGeneration((v) => v + 1);
            }}
          />
          <Button
            title={compact ? 'Expand map' : 'Shrink map'}
            onPress={() => setCompact((value) => !value)}
          />
          <Button
            title="Cycle subscriber"
            disabled={cycling}
            onPress={() => {
              if (subscriptionTimers.current.length) return;
              setEnabled(true);
              setCycling(true);
              subscriptionTimers.current = [false, true].map((value, index) =>
                setTimeout(
                  () => {
                    append(
                      evidence.current.subscriptionTransitions,
                      {
                        enabled: value,
                        gestureCount: evidence.current.gestures.length,
                      },
                      16,
                    );
                    setEnabled(value);
                    setSummary(
                      value ? 'Subscriber restored' : 'Subscriber removed',
                    );
                    if (value) {
                      subscriptionTimers.current = [];
                      setCycling(false);
                    }
                  },
                  index === 0 ? 6000 : 10000,
                ),
              );
            }}
          />
        </View>
      </ExampleControls>
      <View
        style={compact ? { height: 160 } : { flex: 1 }}
        onLayout={({ nativeEvent }) => {
          evidence.current.viewport = {
            width: nativeEvent.layout.width,
            height: nativeEvent.layout.height,
          };
        }}
      >
        <MapView
          key={generation}
          ref={map}
          style={{ flex: 1 }}
          testID="verification-map"
          styleURL={`https://tiles.openfreemap.org/styles/liberty?verification=${styleEpoch}`}
          initialCamera={{
            center: { latitude: 54.37, longitude: 18.66 },
            zoom: 13,
            heading: 0,
            pitch: 0,
          }}
          onGesture={enabled ? onGesture : undefined}
          gestureEventIntervalMs={interval}
          onPress={
            pressEnabled
              ? (event) => {
                  append(evidence.current.mapPresses, event, 64);
                  setSummary(`Map ${event.action}`);
                }
              : undefined
          }
          onLongPress={
            pressEnabled
              ? (event) => {
                  append(evidence.current.mapPresses, event, 64);
                  setSummary(`Map ${event.action}`);
                }
              : undefined
          }
          onCapabilitiesChange={(capabilities) =>
            append(evidence.current.capabilities, capabilities, 32)
          }
          onMapReady={() => {
            evidence.current.readyCount++;
            setSummary(`Ready · ${evidence.current.readyCount} loads`);
          }}
          onCameraIdle={(event) => append(evidence.current.camera, event, 64)}
          onError={(error) => {
            append(evidence.current.errors, error, 32);
            setSummary(`${error.code} · fatal=${error.fatal}`);
          }}
        >
          {showMarker && (
            <Marker
              id="verification-marker"
              coordinate={{ latitude: 54.37, longitude: 18.66 }}
              anchor={{ x: 0.5, y: 0.5 }}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Verification marker button"
                onPress={() => {
                  evidence.current.markerPresses++;
                  setSummary(`Marker taps ${evidence.current.markerPresses}`);
                }}
                onLongPress={() => {
                  evidence.current.markerLongPresses++;
                  setSummary(
                    `Marker holds ${evidence.current.markerLongPresses}`,
                  );
                }}
                style={{
                  width: 120,
                  height: 60,
                  backgroundColor: '#145e99',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ color: 'white' }}>Marker button</Text>
              </Pressable>
            </Marker>
          )}
          {present && (
            <Circle
              id="verification-shape"
              center={{ latitude: 54.37, longitude: candidate.longitude }}
              radius={60}
              strokeWidth={0}
              fillColor="#e02020"
              tappable
              onPress={(event) => {
                append(evidence.current.featureHits, event, 64);
                setSummary(`Shape hit ${event.nativeEvent.identifier}`);
              }}
            />
          )}
        </MapView>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  controls: { flexDirection: 'row', flexWrap: 'wrap' },
  status: { padding: 8, fontSize: 12 },
});
