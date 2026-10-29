# Marker clustering

Clustering is opt-in on public `Marker` children. The package uses the pinned
MapLibre Native indexes on both platforms, then renders clusters as React Native
marker children. No separate clustering dependency or public source/layer API is
required.

```tsx
import { MapView, Marker } from 'react-native-maplibre-maps';
import { Text, Pressable } from 'react-native';
import type { ClusterComponentProps } from 'react-native-maplibre-maps';

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

Each active group uses one source and one layer. There is no fixed participating-
marker, scene source/layer or aggregate position-count cap. The 4 MiB UTF-8 scene
budget and input validation still apply; membership queries retain 100-member pages.
Clustered coordinates are within ±85° latitude and ±180° longitude. Input arrays,
coordinates and metadata should be immutable. Replace references for updates.

Marker IDs are nonempty strings of at most 512 UTF-16 code units. Unicode and
`cluster:` prefixes are preserved through membership queries and unclustered
layout; only `em-cluster:` is reserved for generated React cluster children.
Omitted IDs use generated identities derived from stable React keys. Source/layer
names use a separate private grammar and do not restrict application marker IDs.

The private index uses radius 50 in the SDK's 512-unit tile convention, maximum
clustering zoom 14 and minimum count 2. These are implementation defaults, not
public tuning props. [Fractional-zoom/overlap](cluster-zoom-acceptance.md) and
[world-wrap/spatial fixtures](cluster-spatial-acceptance.md) record bounded native
acceptance for these defaults.

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

On 2026-10-27, the **Boundary IDs** option in the Debug clustering scenario passed
five-member native ID/metadata round trips on iOS 26.1 (iPhone 17 Pro) and Android
16/API 36 ARM64: `cluster:14`, `cluster:boat`, Unicode, a 512-code-unit ID and an
omitted/generated ID. A single `cluster:14` marker also appears in native
unclustered layout at zoom 16 and selects its original metadata on both hosts.
Compiler regressions cover these
paths, 512/513-unit and surrogate-pair boundaries, and reject cluster handles
without explicit generated-cluster metadata. Both native Debug builds pass.

Android layout notifications keep at most one pending job per map and read the
latest viewport when that job runs. Pause/detach cancels pending work, disposal
closes the scheduler, and resume requests a fresh update. This bounds queued
layout work, not the SDK index memory or the number of visible markers.
[Scheduling acceptance](cluster-scheduling.md) records regression/runtime checks.

Output/index-memory bounds, broader background cancellation and larger spatial-dataset
performance remain under CLUSTER-06. Component membership, overlap, zoom-boundary
and antimeridian acceptance is recorded under CLUSTER-07. Physical-device benchmarks and
resulting tweaks are maintainer-owned follow-up. Removing the marker-count cap does not establish performance at larger counts.
