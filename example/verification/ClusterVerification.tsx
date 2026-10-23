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
  ClusterComponentProps,
  ClusterMember,
  MapViewRef,
} from 'react-native-enhanced-maps';

const Inspection = createContext<(members: readonly ClusterMember[]) => void>(
  () => {},
);
function VesselCluster({ count, getMembers, expand }: ClusterComponentProps) {
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
};
type DebugGlobal = typeof globalThis & {
  __enhancedMapsClusters?: { snapshot(): Evidence };
};
export default function ClusterVerification() {
  const map = useRef<MapViewRef>(null);
  const evidence = useRef<Evidence>({
    memberIDs: [],
    metadata: [],
    errors: [],
    ready: 0,
  });
  const [count, setCount] = useState(3);
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
    const api = { snapshot: () => evidence.current };
    target.__enhancedMapsClusters = api;
    return () => {
      if (target.__enhancedMapsClusters === api)
        delete target.__enhancedMapsClusters;
    };
  }, []);
  return (
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
          {[3, 1000, 10000].map((value) => (
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
                cluster={cluster}
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
  );
}
