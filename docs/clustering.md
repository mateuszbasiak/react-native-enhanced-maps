# Marker clustering

Clustering is opt-in on public `Marker` children. The package uses the pinned
MapLibre Native indexes on both platforms, then renders clusters as React Native
marker children. No separate clustering dependency or public source/layer API is
required.

```tsx
import { MapView, Marker } from 'react-native-enhanced-maps';
import { Text, Pressable } from 'react-native';
import type { ClusterComponentProps } from 'react-native-enhanced-maps';

function FleetCluster({ count, expand }: ClusterComponentProps) {
  return (
    <Pressable onPress={() => void expand()}>
      <Text>{count} boats</Text>
    </Pressable>
  );
}

<MapView
  styleURL={styleURL}
  initialCamera={camera}
  clusterComponent={FleetCluster}
>
  {boats.map((boat) => (
    <Marker
      key={boat.id}
      id={boat.id}
      coordinate={boat.coordinate}
      clusterGroup="boats"
      data={boat.metadata}
    >
      <BoatPin />
    </Marker>
  ))}
</MapView>;
```

Application event handlers should handle rejected `expand()` or `getMembers()`
promises when a cluster can disappear during the operation.

## Participation and groups

`cluster={true}` joins the default group. `clusterGroup="boats"` enables
clustering in that named group unless `cluster={false}` explicitly opts out.
Omitting both keeps the marker independent. Only exactly matching group names
cluster together; distance and zoom still determine membership. Names are nonblank
strings of at most 512 characters. Different groups can overlap visually.

Each active group consumes one source and one layer from the map's shared
64-source/128-layer budget. The total participating-marker input limit is 10000.
Clustered coordinates are within ±85° latitude and ±180° longitude. Input arrays,
coordinates and metadata should be immutable. Replace references for updates.

The private index uses radius 50 in the SDK's 512-unit tile convention, maximum
clustering zoom 14 and minimum count 2. These are implementation defaults, not
public tuning props. Membership near fractional zoom, world wrapping and spatial
boundaries needs the remaining acceptance fixtures.

## Cluster children and lazy members

Without `clusterComponent`, the package supplies a count bubble that expands on
press. A custom component receives `count`, `coordinate`, `clusterGroup` (undefined
for the default group), `getMembers()` and `expand()`. It owns its ordinary React
Native child event handlers and accessible labels.

`getMembers()` resolves all original members as an immutable array of
`{id, coordinate, data}`. Metadata is application-owned and stays in JavaScript;
the native index contains marker IDs and coordinates. Members are fetched in
bounded native pages instead of being copied into each visible cluster. Native
queries share the bounded pending-query broker. `expand()` requests the SDK's
expansion zoom and moves the map; it does not return an animation-completed event.

Cluster callbacks belong to one map and index lifetime. Data/group changes,
accepted scene rebuilds, style replacement and remount can invalidate them.
Obsolete callbacks reject; do not retain them as durable cluster IDs. Source-level
cluster handles and `MapViewRef.getClusterLeaves/getClusterChildren` are retired
public APIs and must not be used by applications.

## Evidence and remaining coverage

[Component acceptance](component-cluster-acceptance.md) records both simulators'
default/custom children, expansion, updates, opt-out behavior, stale callbacks and
complete 3/1000/10000 coincident-member ID/metadata audits. These are bounded
functional checks, not spatial parity or performance measurements. Group semantics
also have [compiler regressions](../tests/marker-clustering.test.mjs).

Output/index-memory bounds, background cancellation, overlap, zoom-boundary and
antimeridian fixtures remain under CLUSTER-06/07. Physical-device benchmarks and
resulting tweaks are maintainer-owned follow-up. The 10000-marker limit does not
establish 100000-marker support.
