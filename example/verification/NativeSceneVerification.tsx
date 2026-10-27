import React, { useEffect, useRef, useState } from 'react';
import {
  Button,
  Dimensions,
  Platform,
  StatusBar,
  Text,
  View,
} from 'react-native';
import NativeMap, {
  Commands,
} from '../../packages/maps/src/specs/MapLibreViewNativeComponent';
import { createMapQueryClient } from '../../packages/maps/src/mapQueries';
import type { Camera, MapPoint } from 'react-native-maplibre-maps';
import { Circle, Polyline } from 'react-native-maplibre-maps';
import { compileScene } from '../../packages/maps/src/maplibreContent';

const origin = { latitude: 54.37, longitude: 18.66 };
const repaired = { latitude: 55.37, longitude: 20.66 };
const cases = [
  'unsupported-layer',
  'invalid-style',
  'invalid-color',
  'invalid-gradient',
  'duplicate-layer',
  'missing-source',
  'invalid-before',
  'invalid-boolean',
  'layer-budget',
  'duplicate-source',
  'numeric-strings',
  'out-of-range',
  'extra-axis',
  'boolean-axis',
  'null-axis',
  'open-hole',
  'invalid-feature',
  'duplicate-id',
  'unsupported-geometry',
  'aggregate-positions',
  'repaired',
  'dateline-circle',
  'dateline-geodesic',
  'dateline-gradient',
] as const;
type Case = (typeof cases)[number];
const rejectionReasons: Partial<Record<Case, string>> = {
  'unsupported-layer': 'Unsupported layer type',
  'invalid-style': 'Invalid layer style number',
  'invalid-color': 'Invalid layer color',
  'invalid-gradient': 'Invalid line gradient',
  'duplicate-layer': 'Duplicate scene layer ID',
  'missing-source': 'Layer references missing source',
  'invalid-before': 'Invalid layer insertion reference',
  'invalid-boolean': 'Invalid layer boolean',
  'layer-budget': 'Map scene resource limit exceeded',
  'duplicate-source': 'Duplicate scene source ID',
  'numeric-strings': 'GeoJSON longitude must be a number',
  'out-of-range': 'GeoJSON position is outside geographic bounds',
  'extra-axis': 'GeoJSON position needs exactly two axes',
  'boolean-axis': 'GeoJSON longitude must be a number',
  'null-axis': 'GeoJSON latitude must be a number',
  'open-hole': 'GeoJSON polygon rings must be closed',
  'invalid-feature': 'Expected GeoJSON Feature',
  'duplicate-id': 'Duplicate GeoJSON feature ID',
  'unsupported-geometry': 'Unsupported GeoJSON geometry',
  'aggregate-positions': 'Scene GeoJSON position limit exceeded',
};
function data(geometry: unknown, id = 'accepted') {
  return {
    type: 'FeatureCollection',
    features: [
      { type: 'Feature', id, properties: { fixture: true }, geometry },
    ],
  };
}
function scene(name?: Case) {
  if (name === 'dateline-circle')
    return compileScene(
      React.createElement(Circle, {
        id: name,
        center: { latitude: 0, longitude: 179.9 },
        radius: 50000,
        fillColor: '#e53935',
        strokeColor: '#e53935',
        tappable: true,
        onPress: () => {},
      }),
    ).json;
  if (name === 'dateline-geodesic' || name === 'dateline-gradient')
    return compileScene(
      React.createElement(Polyline, {
        id: name,
        coordinates: [
          { latitude: 0, longitude: 179.4 },
          { latitude: 0, longitude: -179.4 },
        ],
        geodesic: true,
        strokeColor: '#e53935',
        strokeWidth: 26,
        ...(name === 'dateline-gradient'
          ? { strokeColors: ['#e53935', '#0000ff'] }
          : {}),
        tappable: true,
        onPress: () => {},
      }),
    ).json;
  let geometry: unknown = {
    type: 'Point',
    coordinates: [origin.longitude, origin.latitude],
  };
  if (name === 'numeric-strings')
    geometry = { type: 'Point', coordinates: ['12', '34'] };
  if (name === 'out-of-range')
    geometry = { type: 'Point', coordinates: [181, 91] };
  if (name === 'extra-axis')
    geometry = { type: 'Point', coordinates: [18.66, 54.37, 1] };
  if (name === 'boolean-axis')
    geometry = { type: 'Point', coordinates: [true, 54.37] };
  if (name === 'null-axis')
    geometry = { type: 'Point', coordinates: [18.66, null] };
  if (name === 'unsupported-geometry')
    geometry = { type: 'GeometryCollection', geometries: [] };
  if (name === 'open-hole')
    geometry = {
      type: 'Polygon',
      coordinates: [
        [
          [18.65, 54.36],
          [18.67, 54.36],
          [18.67, 54.38],
          [18.65, 54.38],
          [18.65, 54.36],
        ],
        [
          [18.655, 54.365],
          [18.665, 54.365],
          [18.665, 54.375],
          [18.655, 54.375],
        ],
      ],
    };
  if (name === 'repaired')
    geometry = {
      type: 'Point',
      coordinates: [repaired.longitude, repaired.latitude],
    };
  const value = data(geometry, name === 'repaired' ? 'repaired' : 'accepted');
  if (name === 'invalid-feature') value.features[0]!.type = 'Point';
  if (name === 'duplicate-id') value.features.push({ ...value.features[0]! });
  const sources = [
    {
      id: 'native-scene-fixture',
      type: 'geojson',
      revision: name ? 2 : 1,
      data: value,
    },
  ];
  if (name === 'aggregate-positions') {
    sources[0]!.data = data({
      type: 'MultiPoint',
      coordinates: Array.from({ length: 25000 }, () => [22, 55]),
    });
    sources.push({
      id: 'native-scene-overflow',
      type: 'geojson',
      revision: 1,
      data: data({
        type: 'MultiPoint',
        coordinates: Array.from({ length: 25001 }, () => [22, 55]),
      }),
    });
  }
  const layers: Record<string, unknown>[] = [
    {
      id: 'native-scene-circle',
      source: 'native-scene-fixture',
      type: name === 'unsupported-layer' ? 'unsupported' : 'circle',
      visible: true,
      interactive: true,
      style: { circleColor: '#e53935', circleOpacity: 1, circleRadius: 26 },
    },
  ];
  if (name === 'invalid-style') layers[0]!.style = { circleRadius: '26' };
  if (name === 'invalid-color') layers[0]!.style = { circleColor: '#112233\n' };
  if (name === 'invalid-gradient') {
    layers[0]!.type = 'line';
    layers[0]!.style = {
      lineGradient: [
        [0, '#112233\n'],
        [1, '#445566'],
      ],
    };
  }
  if (name === 'duplicate-layer') layers.push({ ...layers[0] });
  if (name === 'missing-source') layers[0]!.source = 'missing-source';
  if (name === 'invalid-before') layers[0]!.beforeId = 'missing-layer';
  if (name === 'invalid-boolean') layers[0]!.visible = 'false';
  if (name === 'layer-budget')
    for (let i = 1; i < 129; i++)
      layers.push({ ...layers[0], id: `overflow-${i}` });
  if (name === 'duplicate-source') sources.push({ ...sources[0]! });
  return JSON.stringify({ sources, layers });
}
type Evidence = {
  ready: boolean;
  platform: string;
  status: 'idle' | 'running' | 'passed' | 'failed' | 'cancelled';
  phase: string;
  tapTarget?: { x: number; y: number };
  rejectionCount: number;
  pressCount: number;
  rejections: { code: string; message: string; sequence: number }[];
  checks: {
    name: Case;
    rejected: boolean;
    fitPreserved?: boolean;
    pressed: string;
    sourceId: string;
  }[];
  presses: { featureId: string; sourceId: string }[];
  error: string;
};
type DebugGlobal = typeof globalThis & {
  __enhancedMapsNativeScene?: {
    snapshot(): Evidence;
    run(names?: readonly Case[]): Promise<void>;
  };
};

/** Deliberately bypasses the public compiler to exercise raw Fabric scene transport. */
export default function NativeSceneVerification() {
  const native = useRef<React.ElementRef<typeof NativeMap>>(null);
  const host = useRef<View>(null);
  const frame = useRef({ x: 0, y: 0, width: 0, height: 0 });
  const alive = useRef(true),
    running = useRef(false);
  const evidence = useRef<Evidence>({
    ready: false,
    platform: Platform.OS,
    status: 'idle',
    phase: 'idle',
    rejectionCount: 0,
    pressCount: 0,
    rejections: [],
    checks: [],
    presses: [],
    error: '',
  });
  const [sceneJSON, setSceneJSON] = useState(() => scene());
  const [summary, setSummary] = useState('Waiting for native map');
  const [targetLabel, setTargetLabel] = useState('Target pending');
  const [queries] = useState(() =>
    createMapQueryClient((id, request) => {
      if (!native.current) throw new Error('Native fixture is unmounted');
      Commands.queryMap(native.current, id, JSON.stringify(request));
    }),
  );
  const run = useRef<(names?: readonly Case[]) => Promise<void>>(
    async () => {},
  );
  run.current = async (names = cases) => {
    if (
      !names.length ||
      names.length > cases.length ||
      names.some((name) => !cases.includes(name))
    )
      throw new Error('Invalid native scene cases');
    if (running.current || evidence.current.status !== 'idle')
      throw new Error('Remount this fixture before another run');
    running.current = true;
    evidence.current.status = 'running';
    const wait = async (
      condition: () => boolean | Promise<boolean>,
      timeout = 5000,
    ) => {
      const started = Date.now();
      while (!(await condition())) {
        if (!alive.current) throw new Error('Native scene run cancelled');
        if (evidence.current.error) throw new Error(evidence.current.error);
        if (Date.now() - started > timeout)
          throw new Error('Native scene acceptance timed out');
        await new Promise<void>((resolve) => setTimeout(resolve, 50));
      }
      if (!alive.current) throw new Error('Native scene run cancelled');
      if (evidence.current.error) throw new Error(evidence.current.error);
    };
    try {
      await wait(
        () =>
          evidence.current.ready &&
          frame.current.width > 0 &&
          frame.current.height > 0,
        15000,
      );
      for (const name of names) {
        const before = evidence.current.rejectionCount;
        const reason = rejectionReasons[name];
        const generated =
          name === 'dateline-circle' ||
          name === 'dateline-geodesic' ||
          name === 'dateline-gradient';
        evidence.current.phase = name;
        setSummary(`Checking ${name}`);
        setSceneJSON(scene(name));
        if (reason)
          await wait(() =>
            evidence.current.rejections.some(
              (value) =>
                value.sequence > before &&
                value.code === 'layer-scene' &&
                value.message === reason,
            ),
          );
        const expected = generated
          ? { latitude: 0, longitude: 179.9 }
          : name === 'repaired'
            ? repaired
            : origin;
        await wait(async () => {
          if (!reason && evidence.current.rejectionCount !== before)
            throw new Error('Valid replacement scene was rejected');
          if (generated) {
            if (!native.current)
              throw new Error('Native scene fixture disposed');
            Commands.animateCamera(
              native.current,
              expected.latitude,
              expected.longitude,
              7,
              0,
              0,
              0,
            );
          } else
            await queries.request(
              'fit',
              {
                coordinatesJSON: '',
                durationMs: 0,
                top: 20,
                right: 20,
                bottom: 20,
                left: 20,
              },
              0,
            );
          const camera = (await queries.request('camera', {}, 0)) as Camera;
          const matches =
            Math.abs(camera.center.latitude - expected.latitude) <= 0.0001 &&
            Math.abs(camera.center.longitude - expected.longitude) <= 0.0001;
          if (!matches && reason)
            throw new Error(`Accepted geometry changed after ${name}`);
          return matches;
        });
        if (!reason && evidence.current.rejectionCount !== before)
          throw new Error('Corrected scene was rejected');
        const pressCount = evidence.current.pressCount;
        const point = (await queries.request(
          'point',
          { latitude: expected.latitude, longitude: expected.longitude },
          0,
        )) as MapPoint;
        const screen = Dimensions.get('screen');
        const tapTarget = {
          x: (frame.current.x + point.x) / screen.width,
          y:
            (frame.current.y +
              point.y +
              (Platform.OS === 'android'
                ? (StatusBar.currentHeight ?? 0)
                : 0)) /
            screen.height,
        };
        if (
          !Number.isFinite(tapTarget.x) ||
          !Number.isFinite(tapTarget.y) ||
          tapTarget.x < 0 ||
          tapTarget.x > 1 ||
          tapTarget.y < 0 ||
          tapTarget.y > 1
        )
          throw new Error('Native test feature is outside the viewport');
        evidence.current.tapTarget = tapTarget;
        setTargetLabel(
          `Target ${tapTarget.x.toFixed(4)}, ${tapTarget.y.toFixed(4)}`,
        );
        evidence.current.phase = `tap:${name}`;
        setSummary(`Tap red feature · ${name}`);
        await wait(() => {
          if (!reason && evidence.current.rejectionCount !== before)
            throw new Error('Valid replacement scene was rejected');
          return evidence.current.pressCount > pressCount;
        }, 60000);
        const pressed = evidence.current.presses.at(-1)!;
        const sourceId = generated ? name : 'native-scene-fixture';
        if (
          pressed.featureId !==
            (generated
              ? 'geometry'
              : name === 'repaired'
                ? 'repaired'
                : 'accepted') ||
          pressed.sourceId !== sourceId
        )
          throw new Error(`Wrong native feature after ${name}`);
        evidence.current.checks.push({
          name,
          rejected: !!reason,
          ...(generated ? {} : { fitPreserved: true }),
          pressed: pressed.featureId,
          sourceId: pressed.sourceId,
        });
        console.info(
          `EnhancedMaps native scene completed ${evidence.current.checks.length}/${names.length}`,
        );
      }
      if (!alive.current) throw new Error('Native scene run cancelled');
      evidence.current.phase = 'complete';
      evidence.current.status = 'passed';
      setSummary(`Passed ${names.length} native scene checks`);
      console.info(
        'EnhancedMaps native scene result ' + JSON.stringify(evidence.current),
      );
    } catch (error) {
      evidence.current.status = alive.current ? 'failed' : 'cancelled';
      evidence.current.error = String(error);
      if (alive.current) setSummary(String(error));
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
      run: (names?: readonly Case[]) => run.current(names),
    };
    target.__enhancedMapsNativeScene = api;
    return () => {
      alive.current = false;
      queries.cancelAll('Native scene fixture disposed');
      if (target.__enhancedMapsNativeScene === api)
        delete target.__enhancedMapsNativeScene;
    };
  }, [queries]);
  return (
    <View style={{ flex: 1 }}>
      <Text testID="native-scene-status" numberOfLines={1}>
        {summary}
      </Text>
      <Button
        title="Run native scene checks"
        onPress={() => {
          void run.current().catch(() => {});
        }}
      />
      <Text testID="native-scene-target" numberOfLines={1}>
        {targetLabel}
      </Text>
      <View
        ref={host}
        style={{ flex: 1 }}
        onLayout={() =>
          host.current?.measureInWindow((x, y, width, height) => {
            frame.current = { x, y, width, height };
          })
        }
      >
        <NativeMap
          ref={native}
          style={{ flex: 1 }}
          styleURL="https://tiles.openfreemap.org/styles/liberty"
          styleRevision={0}
          sceneJSON={sceneJSON}
          initialLatitude={origin.latitude}
          initialLongitude={origin.longitude}
          initialZoom={12}
          onMapReady={() => {
            evidence.current.ready = true;
            if (!running.current) setSummary('Ready: raw native transport');
          }}
          onMapError={({ nativeEvent }) => {
            evidence.current.rejectionCount++;
            evidence.current.rejections.push({
              code: nativeEvent.code,
              message: nativeEvent.message,
              sequence: evidence.current.rejectionCount,
            });
            evidence.current.rejections =
              evidence.current.rejections.slice(-32);
            if (nativeEvent.code !== 'layer-scene')
              evidence.current.error = nativeEvent.message;
          }}
          onMapQueryResult={({ nativeEvent }) =>
            queries.accept(
              nativeEvent.requestId,
              nativeEvent.resultJSON,
              nativeEvent.error,
            )
          }
          onFeaturePress={({ nativeEvent }) => {
            evidence.current.pressCount++;
            evidence.current.presses.push({
              featureId: nativeEvent.featureId,
              sourceId: nativeEvent.sourceId,
            });
            evidence.current.presses = evidence.current.presses.slice(-32);
          }}
        />
      </View>
    </View>
  );
}
