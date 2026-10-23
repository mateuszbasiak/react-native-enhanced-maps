// @refresh reset
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Platform, Text, View } from 'react-native';
import { GeoJSONSource, Layer, MapView } from 'react-native-enhanced-maps';
import type {
  CameraEvent,
  GeoJSONData,
  MapError,
  MapFeaturePressEvent,
  MapPoint,
  MapViewRef,
  ClusterHandle,
  ClusterPage,
} from 'react-native-enhanced-maps';

const data: GeoJSONData = {
  type: 'FeatureCollection',
  features: [
    ['duplicate-a', 18.66],
    ['duplicate-b', 18.66],
    ['near-c', 18.662],
    ['isolated-d', 18.674],
  ].map(([id, longitude]) => ({
    type: 'Feature',
    id: id as string,
    properties: { name: id },
    geometry: { type: 'Point', coordinates: [longitude as number, 54.37] },
  })),
};
type Evidence = {
  platform: string;
  readyCount: number;
  hits: MapFeaturePressEvent[];
  errors: MapError[];
  camera: CameraEvent[];
  locations: { name: string; point: MapPoint }[];
  queryErrors: string[];
  inspections: {
    leaves: ClusterPage[];
    children: ClusterPage;
    zoom: number;
    empty: ClusterPage;
    childLeaves?: ClusterPage;
    childZoom?: number;
  }[];
  audits: {
    expected: number;
    total: number;
    unique: number;
    pages: number;
    emptyTerminal: boolean;
    immutable: boolean;
    matched: boolean;
  }[];
};
const append = <T,>(array: T[], value: T) => {
  array.push(value);
  if (array.length > 32) array.shift();
};
const center = { latitude: 54.37, longitude: 18.661 };

/** Deterministic, development-only native clustering fixture. */
export default function ClusterVerification() {
  const map = useRef<MapViewRef>(null);
  const selected = useRef<ClusterHandle | null>(null);
  const [purple, setPurple] = useState(false);
  const [clustering, setClustering] = useState(true);
  const [revision, setRevision] = useState(1);
  const [minimum, setMinimum] = useState(2);
  const [styleEpoch, setStyleEpoch] = useState(0);
  const [generation, setGeneration] = useState(0);
  const [summary, setSummary] = useState('Waiting for clusters');
  const [denseCount, setDenseCount] = useState(0);
  const fixtureData = useMemo<GeoJSONData>(
    () =>
      denseCount
        ? {
            type: 'FeatureCollection',
            features: Array.from({ length: denseCount }, (_, index) => ({
              type: 'Feature',
              id: `dense-${index}`,
              geometry: { type: 'Point', coordinates: [18.66, 54.37] },
              properties: { ordinal: index },
            })),
          }
        : data,
    [denseCount],
  );
  const evidence = useRef<Evidence>({
    platform: Platform.OS,
    readyCount: 0,
    hits: [],
    errors: [],
    camera: [],
    locations: [],
    queryErrors: [],
    inspections: [],
    audits: [],
  });
  useEffect(() => {
    const target = globalThis as typeof globalThis & {
      __enhancedMapsClusters?: {
        snapshot: () => Evidence & { revision: number; minimum: number };
      };
    };
    const api = {
      snapshot: () => ({ ...evidence.current, revision, minimum }),
    };
    target.__enhancedMapsClusters = api;
    return () => {
      if (target.__enhancedMapsClusters === api)
        delete target.__enhancedMapsClusters;
    };
  }, [revision, minimum]);
  return (
    <View style={{ flex: 1 }}>
      <Text numberOfLines={1}>{summary}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        <Button
          title="Locate cluster fixture"
          onPress={async () => {
            try {
              const current = map.current;
              if (!current) throw new Error('No map');
              const positions = [
                ['cluster', (18.66 * 2 + 18.662) / 3],
                ['duplicate', 18.66],
                ['near', 18.662],
                ['isolated', 18.674],
              ] as const;
              const locations = await Promise.all(
                positions.map(async ([name, longitude]) => ({
                  name,
                  point: await current.pointForCoordinate({
                    latitude: 54.37,
                    longitude,
                  }),
                })),
              );
              evidence.current.locations = locations;
              setSummary('Fixture located');
            } catch (error) {
              append(evidence.current.queryErrors, String(error));
              setSummary(String(error));
            }
          }}
        />
        <Button
          title="Low zoom"
          onPress={() =>
            map.current?.animateCamera(
              { center, zoom: 13, heading: 0, pitch: 0 },
              0,
            )
          }
        />
        <Button
          title="High zoom"
          onPress={() =>
            map.current?.animateCamera(
              { center, zoom: 16, heading: 0, pitch: 0 },
              0,
            )
          }
        />
        <Button title="Stale min 4" onPress={() => setMinimum(4)} />
        <Button
          title="Accept min 4"
          onPress={() => {
            setRevision((value) => value + 1);
            setMinimum(4);
          }}
        />
        <Button
          title="Restore clustering"
          onPress={() => {
            setClustering(true);
            setRevision((value) => value + 1);
            setMinimum(2);
          }}
        />
        <Button
          title="Reload cluster style"
          onPress={() => setStyleEpoch((value) => value + 1)}
        />
        <Button
          title="Remount clusters"
          onPress={() => setGeneration((value) => value + 1)}
        />
        <Button
          title="Inspect held cluster"
          onPress={async () => {
            try {
              const current = map.current,
                cluster = selected.current;
              if (!current || !cluster) throw new Error('Tap a cluster first');
              const [first, second, children, zoom] = await Promise.all([
                current.getClusterLeaves(cluster, { limit: 2 }),
                current.getClusterLeaves(cluster, { limit: 2, offset: 2 }),
                current.getClusterChildren(cluster),
                current.getClusterExpansionZoom(cluster),
              ]);
              const child = children.features.find(
                (feature) => feature.cluster,
              )?.cluster;
              const empty = await current.getClusterLeaves(cluster, {
                limit: 2,
                offset: first.total,
              });
              const childLeaves = child
                ? await current.getClusterLeaves(child)
                : undefined;
              const childZoom = child
                ? await current.getClusterExpansionZoom(child)
                : undefined;
              append(evidence.current.inspections, {
                leaves: [first, second],
                children,
                zoom,
                empty,
                childLeaves,
                childZoom,
              });
              setSummary(`Inspected ${first.total} leaves, expansion ${zoom}`);
            } catch (error) {
              append(evidence.current.queryErrors, String(error));
              setSummary(String(error));
            }
          }}
        />
        <Button
          title="Query copied handle"
          onPress={async () => {
            try {
              if (!selected.current || !map.current)
                throw new Error('Tap a cluster first');
              await map.current.getClusterLeaves({ ...selected.current });
              throw new Error('Copied handle unexpectedly accepted');
            } catch (error) {
              append(evidence.current.queryErrors, String(error));
              setSummary(String(error));
            }
          }}
        />
        <Button
          title="Recolor clusters"
          onPress={() => setPurple((value) => !value)}
        />
        <Button title="Stale disable" onPress={() => setClustering(false)} />
        {[0, 1000, 10000].map((count) => (
          <Button
            key={count}
            title={count ? `Dense ${count}` : 'Four points'}
            onPress={() => {
              selected.current = null;
              setClustering(true);
              setMinimum(2);
              setDenseCount(count);
              setRevision((value) => value + 1);
            }}
          />
        ))}
        <Button
          title="Audit all leaves"
          onPress={async () => {
            try {
              const current = map.current,
                cluster = selected.current;
              if (!current || !cluster) throw new Error('Tap a cluster first');
              const expected = denseCount
                ? Array.from({ length: denseCount }, (_, i) => `dense-${i}`)
                : ['duplicate-a', 'duplicate-b', 'near-c'];
              const ids: string[] = [];
              let pages = 0,
                total = 0,
                immutable = true;
              for (let offset = 0; offset < 10000; offset += 100) {
                const page = await current.getClusterLeaves(cluster, {
                  limit: 100,
                  offset,
                });
                total = page.total;
                pages++;
                immutable &&=
                  Object.isFrozen(page) &&
                  Object.isFrozen(page.features) &&
                  page.features.every(
                    (feature) =>
                      Object.isFrozen(feature) &&
                      Object.isFrozen(feature.coordinate) &&
                      Object.isFrozen(feature.properties),
                  );
                ids.push(...page.features.map((feature) => feature.featureId));
                if (offset + 100 >= total) break;
              }
              const terminal = await current.getClusterLeaves(cluster, {
                offset: total,
              });
              const actual = new Set(ids);
              const result = {
                expected: expected.length,
                total,
                unique: actual.size,
                pages,
                emptyTerminal: terminal.features.length === 0,
                immutable,
                matched:
                  total === expected.length &&
                  ids.length === expected.length &&
                  actual.size === expected.length &&
                  expected.every((id) => actual.has(id)),
              };
              append(evidence.current.audits, result);
              if (!result.matched || !result.immutable || !result.emptyTerminal)
                throw new Error(`Leaf audit failed: ${JSON.stringify(result)}`);
              setSummary(
                `Audited ${actual.size} unique leaves in ${pages} pages`,
              );
            } catch (error) {
              append(evidence.current.queryErrors, String(error));
              setSummary(String(error));
            }
          }}
        />
      </View>
      <MapView
        key={generation}
        ref={map}
        style={{ flex: 1 }}
        testID="cluster-verification-map"
        styleURL={`https://tiles.openfreemap.org/styles/liberty?clusterVerification=${styleEpoch}`}
        initialCamera={{ center, zoom: 13, heading: 0, pitch: 0 }}
        onMapReady={() => {
          evidence.current.readyCount++;
          setSummary('Clusters ready');
        }}
        onCameraIdle={(event) => append(evidence.current.camera, event)}
        onError={(error) => {
          append(evidence.current.errors, error);
          setSummary(error.message);
        }}
      >
        <GeoJSONSource
          id="cluster-fixture"
          data={fixtureData}
          revision={revision}
          cluster={
            clustering ? { radius: 50, maxZoom: 14, minPoints: minimum } : false
          }
          onFeaturePress={(event) => {
            if (event.cluster) selected.current = event.cluster;
            append(evidence.current.hits, event);
            setSummary(
              `${event.featureId} · ${JSON.stringify(event.properties)}`,
            );
          }}
        >
          <Layer
            id="fixture-clusters"
            type="circle"
            clusterFilter={clustering ? 'clusters' : undefined}
            style={{
              circleColor: purple ? '#8800ff' : '#0055ff',
              circleRadius: 18,
            }}
          />
          <Layer
            id="fixture-points"
            type="circle"
            clusterFilter={clustering ? 'points' : undefined}
            style={{ circleColor: '#ff6600', circleRadius: 8 }}
          />
        </GeoJSONSource>
      </MapView>
    </View>
  );
}
