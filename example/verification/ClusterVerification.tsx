import ExampleControls from '../ExampleControls';
import { runClusterSpatialChecks } from '../../scripts/cluster-spatial-expression.mjs';
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Button, Platform, Pressable, Text, View } from 'react-native';
import { MapView, Marker } from 'react-native-maplibre-maps';
import type {
  CameraEvent,
  Camera,
  ClusterComponentProps,
  ClusterMember,
  MapViewRef,
} from 'react-native-maplibre-maps';

const Inspection = createContext<(members: readonly ClusterMember[]) => void>(
  () => {},
);
const ClusterRegistry = createContext<
  (props: ClusterComponentProps) => () => void
>(() => () => {});
function VesselCluster(props: ClusterComponentProps) {
  const { count, getMembers, expand } = props;
  const register = useContext(ClusterRegistry);
  useEffect(() => register(props), [register, props]);
  const inspect = useContext(Inspection);
  const [error, setError] = useState('');
  return (
    <View style={{ backgroundColor: '#145e99', borderRadius: 12, padding: 8 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Inspect ${count} markers`}
        onPress={() => {
          void getMembers()
            .then(inspect)
            .catch((reason) => setError(String(reason)));
        }}
      >
        <Text style={{ color: 'white' }}>Inspect {count} markers</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Expand cluster"
        onPress={() => {
          void expand().catch((reason) => setError(String(reason)));
        }}
      >
        <Text style={{ color: 'white' }}>Expand cluster</Text>
      </Pressable>
      {!!error && <Text>{error}</Text>}
    </View>
  );
}
const initialCamera = {
  center: { latitude: 54.37, longitude: 18.66 },
  zoom: 13,
  heading: 0,
  pitch: 0,
};
type Evidence = {
  platform: string;
  viewport: { width: number; height: number };
  memberIDs: string[];
  metadata: unknown[];
  errors: string[];
  ready: number;
  camera: CameraEvent | null;
};
type DebugGlobal = typeof globalThis & {
  __enhancedMapsClusters?: {
    snapshot(): Evidence & {
      clusters: {
        count: number;
        coordinate: ClusterComponentProps['coordinate'];
        clusterGroup?: string;
      }[];
    };
    configure(options: {
      count?: number;
      custom?: boolean;
      present?: boolean;
      clustered?: boolean;
      moved?: boolean;
      grouped?: boolean;
      identityCases?: boolean;
      layout?: 'coincident' | 'spatial' | 'antimeridian';
    }): void;
    remount(): void;
    reloadStyle(): void;
    animate(zoom: number): void;
    capture(clusterGroup?: string): ClusterComponentProps | undefined;
    inspect(expectedCount?: number): Promise<readonly ClusterMember[]>;
    runSpatialChecks(): Promise<unknown>;
    moveCamera(camera: Camera): Promise<void>;
    getCamera(): Promise<Camera>;
    inspectAll(): Promise<
      {
        count: number;
        coordinate: ClusterComponentProps['coordinate'];
        clusterGroup?: string;
        members: readonly ClusterMember[];
      }[]
    >;
  };
};
export default function ClusterVerification() {
  const map = useRef<MapViewRef>(null);
  const evidence = useRef<Evidence>({
    platform: Platform.OS,
    viewport: { width: 0, height: 0 },
    memberIDs: [],
    metadata: [],
    errors: [],
    ready: 0,
    camera: null,
  });
  const handles = useRef(new Set<ClusterComponentProps>());
  const register = useMemo(
    () => (props: ClusterComponentProps) => {
      handles.current.add(props);
      return () => {
        handles.current.delete(props);
      };
    },
    [],
  );
  const [count, setCount] = useState(3);
  const [grouped, setGrouped] = useState(false);
  const [cluster, setCluster] = useState(true);
  const [custom, setCustom] = useState(true);
  const [present, setPresent] = useState(true);
  const [generation, setGeneration] = useState(0);
  const [styleEpoch, setStyleEpoch] = useState(0);
  const [moved, setMoved] = useState(false);
  const [identityCases, setIdentityCases] = useState(false);
  const [layout, setLayout] = useState<
    'coincident' | 'spatial' | 'antimeridian'
  >('coincident');
  const [summary, setSummary] = useState('Waiting for map');
  const markers = useMemo(
    () =>
      Array.from({ length: count }, (_, index) => ({
        id:
          identityCases && index < 5
            ? ['cluster:14', 'cluster:boat', '船', '船'.repeat(512)][index]
            : `vessel-${index}`,
        key: `vessel-${index}`,
        coordinate:
          layout === 'spatial'
            ? {
                latitude:
                  (Math.floor(index / 3) % 2 ? 0.1 : -0.1) +
                  (index % 3) * 0.00001,
                longitude:
                  (Math.floor(index / 6) % 2 ? 0.2 : -0.2) +
                  (index % 3) * 0.00001,
              }
            : layout === 'antimeridian'
              ? {
                  latitude: (index % 3) * 0.00001,
                  longitude:
                    (index % 6 < 3 ? 179.8 : -179.8) + (index % 3) * 0.00001,
                }
              : { latitude: 54.37, longitude: 18.66 + (moved ? 0.02 : 0) },
        data: {
          name: `Vessel ${index}`,
          status: index % 2 ? 'moving' : 'moored',
        },
      })),
    [count, moved, identityCases, layout],
  );
  useEffect(() => {
    if (!__DEV__) return;
    const target = globalThis as DebugGlobal;
    let disposed = false;
    const waitForCluster = async (expectedCount?: number) => {
      const deadline = Date.now() + 15000;
      while (!disposed && Date.now() < deadline) {
        const handle = [...handles.current].find(
          (value) =>
            expectedCount === undefined || value.count === expectedCount,
        );
        if (handle) return handle;
        await new Promise<void>((resolve) => setTimeout(resolve, 50));
      }
      throw new Error(
        disposed
          ? 'Cluster fixture disposed'
          : 'Timed out waiting for custom cluster',
      );
    };
    const api = {
      runSpatialChecks: (): Promise<unknown> => runClusterSpatialChecks(api),
      snapshot: () => ({
        ...evidence.current,
        clusters: [...handles.current].map(
          ({ count, coordinate, clusterGroup }) => ({
            ...(clusterGroup === undefined ? {} : { clusterGroup }),
            count,
            coordinate,
          }),
        ),
      }),
      configure: (options: {
        count?: number;
        custom?: boolean;
        present?: boolean;
        clustered?: boolean;
        moved?: boolean;
        grouped?: boolean;
        identityCases?: boolean;
        layout?: 'coincident' | 'spatial' | 'antimeridian';
      }) => {
        if (options.count !== undefined) {
          if (
            !Number.isInteger(options.count) ||
            options.count < 1 ||
            options.count > 10000
          )
            throw new RangeError('Invalid fixture marker count');
          setCount(options.count);
        }
        if (options.custom !== undefined) setCustom(options.custom);
        if (options.present !== undefined) setPresent(options.present);
        if (options.clustered !== undefined) setCluster(options.clustered);
        if (options.grouped !== undefined) setGrouped(options.grouped);
        if (options.moved !== undefined) setMoved(options.moved);
        if (options.identityCases !== undefined)
          setIdentityCases(options.identityCases);
        if (options.layout !== undefined) {
          if (
            !['coincident', 'spatial', 'antimeridian'].includes(options.layout)
          )
            throw new Error('Invalid fixture layout');
          setLayout(options.layout);
        }
      },
      remount: () => setGeneration((v) => v + 1),
      reloadStyle: () => setStyleEpoch((v) => v + 1),
      animate: (zoom: number) =>
        map.current?.animateCamera({ ...initialCamera, zoom }, 0),
      capture: (clusterGroup?: string) =>
        [...handles.current].find(
          (handle) =>
            clusterGroup === undefined || handle.clusterGroup === clusterGroup,
        ),
      inspect: async (expectedCount?: number) => {
        const handle = await waitForCluster(expectedCount);
        const members = await handle.getMembers();
        evidence.current.memberIDs = members.map((member) => member.id);
        evidence.current.metadata = members.map((member) => member.data);
        return members;
      },
      moveCamera: async (camera: Camera) => {
        if (!map.current) throw new Error('Map missing');
        await map.current.setCamera(camera);
      },
      getCamera: async () => {
        if (!map.current) throw new Error('Map missing');
        return map.current.getCamera();
      },
      inspectAll: async () => {
        const current = [...handles.current];
        if (current.length > 32)
          throw new Error('Fixture cluster inspection limit exceeded');
        return Promise.all(
          current.map(
            async ({ count, coordinate, clusterGroup, getMembers }) => ({
              count,
              coordinate,
              clusterGroup,
              members: await getMembers(),
            }),
          ),
        );
      },
    };
    target.__enhancedMapsClusters = api;
    return () => {
      disposed = true;
      if (target.__enhancedMapsClusters === api)
        delete target.__enhancedMapsClusters;
    };
  }, []);
  return (
    <ClusterRegistry.Provider value={register}>
      <Inspection.Provider
        value={(members) => {
          evidence.current.memberIDs = members.map((member) => member.id);
          evidence.current.metadata = members.map((member) => member.data);
          setSummary(
            `${members.length} members · ${members
              .slice(0, 3)
              .map((member) => member.id)
              .join(', ')}`,
          );
        }}
      >
        <View style={{ flex: 1 }}>
          <Text testID="cluster-status">{summary}</Text>
          <ExampleControls>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {[3, 6, 1000, 10000].map((value) => (
                <Button
                  key={value}
                  title={`${value} markers`}
                  onPress={() => setCount(value)}
                />
              ))}
              <Button
                title={cluster ? 'Disable clustering' : 'Enable clustering'}
                onPress={() => setCluster((value) => !value)}
              />
              <Button
                title={grouped ? 'Merge groups' : 'Separate groups'}
                onPress={() => setGrouped((value) => !value)}
              />
              <Button
                title={custom ? 'Default bubble' : 'Custom bubble'}
                onPress={() => setCustom((value) => !value)}
              />
              <Button
                title={identityCases ? 'Ordinary IDs' : 'Boundary IDs'}
                onPress={() => {
                  setCount(5);
                  setIdentityCases((value) => !value);
                }}
              />
              <Button
                title="Zoom 13"
                onPress={() => map.current?.animateCamera(initialCamera, 0)}
              />
              <Button
                title="Zoom 16"
                onPress={() =>
                  map.current?.animateCamera({ ...initialCamera, zoom: 16 }, 0)
                }
              />
              <Button
                title="Move markers"
                onPress={() => setMoved((value) => !value)}
              />
              <Button
                title={present ? 'Remove markers' : 'Restore markers'}
                onPress={() => setPresent((value) => !value)}
              />
              <Button
                title="Reload style"
                onPress={() => setStyleEpoch((value) => value + 1)}
              />
              <Button
                title="Remount"
                onPress={() => setGeneration((value) => value + 1)}
              />
            </View>
          </ExampleControls>
          <MapView
            key={generation}
            onLayout={({ nativeEvent: { layout } }) => {
              evidence.current.viewport = {
                width: layout.width,
                height: layout.height,
              };
            }}
            ref={map}
            style={{ flex: 1 }}
            initialCamera={initialCamera}
            styleURL={`https://tiles.openfreemap.org/styles/liberty?cluster=${styleEpoch}`}
            clusterComponent={custom ? VesselCluster : undefined}
            onMapReady={() => {
              evidence.current.ready++;
              setSummary('Ready');
            }}
            onCameraIdle={(event) => {
              evidence.current.camera = event;
            }}
            onError={(error) => {
              evidence.current.errors.push(error.message);
              evidence.current.errors = evidence.current.errors.slice(-32);
              setSummary(error.message);
            }}
          >
            {present &&
              markers.map(({ key, ...marker }) => (
                <Marker
                  key={key}
                  {...marker}
                  {...(grouped && cluster ? {} : { cluster })}
                  {...(grouped ? { clusterGroup: marker.data.status } : {})}
                  anchor={{ x: 0.5, y: 0.5 }}
                >
                  <Pressable
                    accessibilityLabel={marker.id}
                    onPress={() => setSummary(marker.data.name)}
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 12,
                      backgroundColor: '#e07020',
                    }}
                  >
                    <Text>●</Text>
                  </Pressable>
                </Marker>
              ))}
            <Marker
              id="independent"
              coordinate={{ latitude: 54.37, longitude: 18.674 }}
            >
              <Pressable
                accessibilityLabel="Independent marker"
                onPress={() => setSummary('Independent marker selected')}
              >
                <Text>⚓</Text>
              </Pressable>
            </Marker>
          </MapView>
        </View>
      </Inspection.Provider>
    </ClusterRegistry.Provider>
  );
}
