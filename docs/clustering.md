# Native point clustering

Clustering is a prototype backed by the installed MapLibre Native GeoJSON indexes
on iOS and Android. It adds no runtime dependency or separately linked clustering
library. A second native Supercluster dependency would duplicate indexing and
maintenance; a custom grid would introduce different membership/expansion rules.
The installed SDK APIs expose radius, maximum clustering zoom and minimum points,
so the package uses those existing implementations. This decision does not prove
memory, CPU, binary-size or cross-platform membership parity.

```tsx
<GeoJSONSource
  id="places"
  revision={1}
  data={points}
  cluster={{ radius: 50, maxZoom: 14, minPoints: 2 }}
  onFeaturePress={handleFeature}
>
  <Layer
    id="groups"
    type="circle"
    clusterFilter="clusters"
    style={{ circleColor: '#0055ff', circleRadius: 18 }}
  />
  <Layer
    id="individuals"
    type="circle"
    clusterFilter="points"
    style={{ circleColor: '#ff6600', circleRadius: 8 }}
  />
</GeoJSONSource>
```

Use `cluster={true}` for those defaults. False/omission disables clustering.
Options are bounded integers: radius 1–512, maxZoom 0–17, minPoints 2–10000.
Radius uses the SDK's 512-unit tile convention: 512 spans one tile width. It is
not multiplied by device density. Clustering stops above maxZoom; maximum source
tiling zoom retains the SDK default of 18. Fractional-zoom behavior follows the
pinned SDK and needs a broader boundary fixture matrix.

Clustered data must contain Point features. MultiPoint and other geometries are
rejected rather than partially clustered. Input IDs must not start with
`cluster:`. Properties `cluster`, `cluster_id`, `point_count` and
`point_count_abbreviated` are reserved for generated clusters. The private
`__enhanced_maps_cluster_index` property is also reserved and never exposed in
public hits or inspection results. All ordinary
source/scene limits still apply, including 10000 features per source, 50000 scene
positions and 4MiB UTF-8 serialization. Validation occurs before native mutation.

Index settings are part of source revision identity. Increase an explicit
producer revision when changing data **or clustering settings**. A stale/equal
revision replacement rejects and preserves the accepted native scene. Unversioned
sources retain replacement semantics. Layer colors/visibility/filter selection
do not require a new producer revision. `clusterFilter` requires a clustered
source and accepts only `clusters` or `points`; general style expressions are
separate layer work.

Generated cluster hits have `featureId` of `cluster:<native ID>` and standard
`properties.cluster`, `cluster_id`, `point_count` and `point_count_abbreviated`.
Original point hits retain their input ID/properties. Both structured
`onFeaturePress` and legacy `onPress(featureId)` use the synthetic cluster ID.
IDs are scoped to a native index lifetime; do not persist them across source
replacement, scene rebuild, style reload or remount. Distinct source IDs scope
otherwise equal native cluster IDs. Picking reports one topmost feature, so
duplicate-coordinate originals are not all returned by one tap.

The deterministic simulator fixture groups duplicate-a/duplicate-b at longitude
18.66 and near-c at 18.662; isolated-d at 18.674 stays separate, all at latitude
54.37. At zoom 13 both hosts pick cluster:14 with point_count 3 and isolated-d
through different layers. At zoom 16 they pick duplicate-b and near-c as original
points. Raising minPoints to 4 at the same source revision rejects; advancing
the revision makes them individual points at zoom 13. Restoring minPoints 2,
style reload and remount preserve the expected three-point cluster behavior.
Inspection on both simulators also returns exactly duplicate-a, duplicate-b and
near-c as leaves, a child cluster containing the same three leaves, and expansion
zoom 15 for parent and child. Offset 3 returns an empty page with total 3.
Dense fixtures at the same coordinate also pass complete 1000- and 10000-point
ID-set audits on both simulators, using 100-leaf pages (10 and 100 pages).
All expected IDs appear exactly once, pages/features/coordinates/properties are
frozen, and the page at total is empty. This does not measure resource cost or
prove spatial boundary membership.

## Inspecting a cluster

Structured cluster hits provide an opaque `event.cluster` handle. Pass the actual
handle to `mapRef.current.getClusterChildren(handle, page?)`,
`getClusterLeaves(handle, page?)` or `getClusterExpansionZoom(handle)`. Children
and leaves resolve to immutable `{features, total, offset}` pages. Features contain
`featureId`, `coordinate`, original/generated `properties`, and an optional child
`cluster` handle that can be queried with the same methods.

Page defaults are limit 100 and offset 0; limits must be integers 1–100 and offsets
0–10000. Responses are bounded to 100 features and 256KiB UTF-8/characters, with
bounded JSON property depth and node count. Oversized pages reject; request fewer
features. Children paginate the SDK child list, which remains bounded by the
10000-point source limit. Leaves use native SDK pagination. Results expose no
private index stamps. Queries share the 32-pending, five-second query broker.

Handles belong to one MapView and native index lifetime. Copies, reconstructed
objects and handles from another map reject. Any accepted scene rebuild (including
layer recoloring), source replacement, style reload or remount invalidates old
handles; tap again to obtain a fresh handle. Rejected source updates preserve the
accepted index and its handles. Native generated features carry index stamps so
late rendered hits cannot silently target a replacement index. These handles are
runtime capabilities, not serializable identifiers.

Required remaining work includes property aggregation, count-dependent styling/symbols,
stable identity guarantees, dense/overlapping/antimeridian fixtures, background
processing and cancellation, measured output/memory bounds, accessibility and
1k/10k/100k release-device benchmarks. Package parsing/rebuild work currently
runs on the native UI thread; SDK index scheduling and resource cost are not yet
characterized. The current source limit does not establish 100k-point support.

SDK references: [iOS source options](https://maplibre.org/maplibre-native/ios/latest/documentation/maplibre/mlnshapesourceoptionclustered/)
and the pinned local MLNShapeSource headers / Android GeoJsonOptions API. The
package's current capability report schema does not yet expose a clustering field.
