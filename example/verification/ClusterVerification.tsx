import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Button, Pressable, Text, View } from 'react-native';
import { MapView, Marker } from 'react-native-enhanced-maps';
import type {
  CameraEvent,
  ClusterComponentProps,
  ClusterMember,
  MapViewRef,
} from 'react-native-enhanced-maps';

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
    }): void;
    remount(): void;
    reloadStyle(): void;
    animate(zoom: number): void;
    capture(clusterGroup?: string): ClusterComponentProps | undefined;
    inspect(expectedCount?: number): Promise<readonly ClusterMember[]>;
  };
};
export default function ClusterVerification() {
  const map = useRef<MapViewRef>(null);
  const evidence = useRef<Evidence>({
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
  const [summary, setSummary] = useState('Waiting for map');
  const markers = useMemo(
    () =>
      Array.from({ length: count }, (_, index) => ({
        id: `vessel-${index}`,
        coordinate: { latitude: 54.37, longitude: 18.66 + (moved ? 0.02 : 0) },
        data: {
          name: `Vessel ${index}`,
          status: index % 2 ? 'moving' : 'moored',
        },
      })),
    [count, moved],
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
          <MapView
            key={generation}
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
              markers.map((marker) => (
                <Marker
                  key={marker.id}
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
