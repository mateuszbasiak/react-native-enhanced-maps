import ExampleControls from '../ExampleControls';
import { runControlledCameraChecks } from '../../scripts/controlled-camera-expression.mjs';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Button,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MapView, Circle, Marker } from 'react-native-maplibre-maps';
// React Native static image assets must use a literal require.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const parityImage = require('../maplibre/vessel.png');
import type {
  CameraEvent,
  Camera,
  Region,
  UserLocation,
  UserLocationChangeEvent,
  MarkerDragEvent,
  MapCapabilities,
  MapError,
  MapGestureEvent,
  ShapePressEvent,
  MapPressEvent,
  MapPoint,
  MapBounds,
  Coordinate,
  MapViewRef,
} from 'react-native-maplibre-maps';

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
  const [controlledAcceptance, setControlledAcceptance] = useState('idle');
  const controlledAcceptanceRunning = useRef(false);
  const runControlledAcceptance = async () => {
    if (controlledAcceptanceRunning.current) return;
    controlledAcceptanceRunning.current = true;
    setControlledAcceptance('running');
    try {
      const result = await runControlledCameraChecks({
        snapshot: () => evidence.current,
        parity: {
          map: () => map.current!,
          setCamera: setControlledCamera,
          setRegion: setControlledRegion,
          setRegionFeedback: (mode) => {
            regionFeedback.current = mode;
          },
          snapshot: () => ({ regionCounts: { ...regionCounts.current } }),
        },
      });
      console.info(
        '[controlled-camera]',
        JSON.stringify({ status: 'passed', ...result }),
      );
      setControlledAcceptance('passed');
    } catch (error) {
      console.info(
        '[controlled-camera]',
        JSON.stringify({ status: 'failed', error: String(error) }),
      );
      setControlledAcceptance('failed');
    } finally {
      controlledAcceptanceRunning.current = false;
    }
  };
  const [locationFlags, setLocationFlags] = useState({
    showsUserLocation: false,
    followsUserLocation: false,
  });
  const [suppliedUserLocation, setSuppliedUserLocation] =
    useState<UserLocation | null>();
  const locationEvents = useRef<UserLocationChangeEvent[]>([]);
  const [dragEnabled, setDragEnabled] = useState(true);
  const [dragCoordinate, setDragCoordinate] = useState({
    latitude: 54.369,
    longitude: 18.665,
  });
  const dragEvents = useRef<{ phase: string; event: MarkerDragEvent }[]>([]);
  const [parityInitialRegion, setParityInitialRegion] = useState<Region>();
  const readyCamera = useRef<Partial<Camera> | undefined>(undefined);
  const [controlledRegion, setControlledRegion] = useState<Region>();
  const [controlledCamera, setControlledCamera] = useState<Camera>();
  const [parityMarkers, setParityMarkers] = useState(false);
  const regionEvidence = useRef<
    { region: Region; isGesture: boolean; complete: boolean }[]
  >([]);
  const regionCounts = useRef({ changes: 0, completions: 0, feedback: 0 });
  const regionFeedback = useRef<'off' | 'change' | 'complete'>('off');
  const controlledPan = useRef<'camera' | 'region' | undefined>(undefined);
  const panTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const panGeneration = useRef(0);
  useEffect(
    () => () => {
      panGeneration.current++;
      clearTimeout(panTimer.current);
    },
    [],
  );
  const armControlledPan = (mode: 'camera' | 'region') => {
    panGeneration.current++;
    clearTimeout(panTimer.current);
    controlledPan.current = mode;
    regionFeedback.current = 'off';
    setControlledRegion({
      latitude: 20,
      longitude: 38,
      latitudeDelta: 1,
      longitudeDelta: 1,
    });
    setControlledCamera(
      mode === 'camera'
        ? {
            center: { latitude: 20, longitude: 38 },
            zoom: 9,
            heading: 0,
            pitch: 0,
          }
        : undefined,
    );
    setSummary(`Pan with unchanged ${mode} prop`);
  };
  const recordRegion = (
    region: Region,
    isGesture: boolean,
    complete: boolean,
  ) => {
    regionCounts.current[complete ? 'completions' : 'changes']++;
    append(regionEvidence.current, { region, isGesture, complete }, 128);
    if (complete && isGesture && controlledPan.current) {
      const mode = controlledPan.current;
      controlledPan.current = undefined;
      const counts = JSON.stringify(regionCounts.current);
      const generation = panGeneration.current;
      panTimer.current = setTimeout(() => {
        void map.current
          ?.getCamera()
          .then((camera) => {
            if (generation !== panGeneration.current) return;
            const passed =
              Math.abs(camera.center.longitude - 38) > 0.001 &&
              counts === JSON.stringify(regionCounts.current);
            const result = {
              status: passed ? 'passed' : 'failed',
              platform: Platform.OS,
              mode,
              camera,
              regionCounts: { ...regionCounts.current },
            };
            console.info('[controlled-camera-pan]', JSON.stringify(result));
            setSummary(`Controlled ${mode} pan: ${result.status}`);
          })
          .catch((error) => {
            if (generation !== panGeneration.current) return;
            console.info(
              '[controlled-camera-pan]',
              JSON.stringify({ status: 'failed', error: String(error) }),
            );
            setSummary(`Controlled ${mode} pan: failed`);
          });
      }, 1000);
    }
    if (regionFeedback.current === (complete ? 'complete' : 'change')) {
      regionCounts.current.feedback++;
      setControlledRegion({
        longitudeDelta: region.longitudeDelta,
        latitudeDelta: region.latitudeDelta,
        longitude: region.longitude,
        latitude: region.latitude,
      });
    }
  };
  const parityPresses = useRef<unknown[]>([]);
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
      parity: {
        map: () => map.current,
        setUserLocation: setSuppliedUserLocation,
        setLocationFlags,
        setDragEnabled,
        featureSnapshot: () => ({
          locations: locationEvents.current,
          drags: dragEvents.current,
          dragCoordinate,
        }),
        mountRegion: (region: Region, camera?: Partial<Camera>) => {
          readyCamera.current = camera;
          setParityInitialRegion(region);
          setGeneration((value) => value + 1);
        },
        setRegion: setControlledRegion,
        setCamera: setControlledCamera,
        setRegionFeedback: (mode: 'off' | 'change' | 'complete') => {
          regionFeedback.current = mode;
        },
        showMarkers: setParityMarkers,
        setShapeLongitude: (longitude: number) =>
          setCandidate((value) => ({ ...value, longitude })),
        snapshot: () => ({
          regions: regionEvidence.current,
          regionCounts: { ...regionCounts.current },
          presses: parityPresses.current,
        }),
      },
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
  }, [candidate, present, enabled, dragCoordinate]);
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
        {__DEV__ && (
          <>
            <Button
              title={`Controlled camera: ${controlledAcceptance}`}
              disabled={controlledAcceptance === 'running'}
              onPress={() => void runControlledAcceptance()}
            />
            <Button
              title="Arm camera pan"
              disabled={controlledAcceptance === 'running'}
              onPress={() => armControlledPan('camera')}
            />
            <Button
              title="Arm region pan"
              disabled={controlledAcceptance === 'running'}
              onPress={() => armControlledPan('region')}
            />
          </>
        )}
        <MapView
          key={generation}
          ref={map}
          style={{ flex: 1 }}
          testID="verification-map"
          styleURL={`https://tiles.openfreemap.org/styles/liberty?verification=${styleEpoch}`}
          initialRegion={parityInitialRegion}
          initialCamera={
            parityInitialRegion
              ? undefined
              : {
                  center: { latitude: 54.37, longitude: 18.66 },
                  zoom: 13,
                  heading: 0,
                  pitch: 0,
                }
          }
          {...locationFlags}
          userLocation={suppliedUserLocation}
          onUserLocationChange={(event) =>
            append(locationEvents.current, event, 64)
          }
          region={controlledRegion}
          camera={controlledCamera}
          onRegionChange={(region, details) =>
            recordRegion(region, details.isGesture, false)
          }
          onRegionChangeComplete={(region, details) =>
            recordRegion(region, details.isGesture, true)
          }
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
            if (readyCamera.current)
              void map.current
                ?.setCamera(readyCamera.current)
                .catch((error) =>
                  append(evidence.current.queryErrors, String(error), 32),
                );
            setSummary(`Ready · ${evidence.current.readyCount} loads`);
          }}
          onCameraIdle={(event) => append(evidence.current.camera, event, 64)}
          onError={(error) => {
            append(evidence.current.errors, error, 32);
            setSummary(`${error.code} · fatal=${error.fatal}`);
          }}
        >
          {parityMarkers && (
            <>
              <Marker
                identifier="parity-marker"
                coordinate={{ latitude: 54.37, longitude: 18.66 }}
                onPress={(event) => append(parityPresses.current, event, 32)}
              >
                <Text style={{ backgroundColor: 'orange', padding: 12 }}>
                  RN Maps marker
                </Text>
              </Marker>
              <Marker
                identifier="parity-drag"
                coordinate={dragCoordinate}
                draggable={dragEnabled}
                onDragStart={(event) =>
                  append(dragEvents.current, { phase: 'start', event }, 128)
                }
                onDrag={(event) => {
                  append(dragEvents.current, { phase: 'update', event }, 128);
                  setDragCoordinate(event.nativeEvent.coordinate);
                }}
                onDragEnd={(event) => {
                  append(dragEvents.current, { phase: 'end', event }, 128);
                  setDragCoordinate(event.nativeEvent.coordinate);
                }}
                onDragCancel={(event) =>
                  append(dragEvents.current, { phase: 'cancel', event }, 128)
                }
              >
                <Text
                  style={{
                    backgroundColor: '#245bc7',
                    color: 'white',
                    padding: 10,
                  }}
                >
                  Drag marker
                </Text>
              </Marker>
              <Marker
                identifier="parity-image"
                coordinate={{ latitude: 54.369, longitude: 18.657 }}
                image={parityImage}
              />
              <Marker
                coordinate={{ latitude: 54.371, longitude: 18.663 }}
                pinColor="purple"
              />
            </>
          )}
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
