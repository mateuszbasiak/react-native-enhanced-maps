# Native clustering implementation plan

Goal: deliver the required native clustering workstream on the package-owned
MapLibre hosts, with authoritative membership and lifecycle verification.

Decision: use each pinned MapLibre SDK's built-in native GeoJSON clustering.
Alternatives were an additional native Supercluster dependency (duplicate index
and binary/dependency maintenance), or a custom grid index (different membership
and expansion semantics). Built-in clustering adds no dependency or linked SDK;
it reuses installed Android 13.6.1/iOS 6.31.0 source options and inspection APIs.
Runtime index memory/cost remains to be measured; no zero-cost claim is made.

First implementation:

1. Add failing validation/serialization tests and public type coverage for
   GeoJSONSource.cluster boolean/options. Defaults radius 50, maxZoom 14,
   minPoints 2; bounded integers radius 1–512, maxZoom 0–17, minPoints 2–10000.
   Radius uses the SDK's 512-unit tile convention, not physical display pixels.
2. Cluster only Point feature collections. Reject reserved cluster metadata
   properties on clustered input. Keep current source/scene budgets intact.
3. Pass normalized options to both native GeoJSON sources. Include options in
   revision identity, so changing index configuration at an equal producer
   revision is rejected before accepted-scene mutation.
4. Add Layer.clusterFilter ('clusters'/'points') and translate it into native
   predicates. Use ordinary circle styles; cluster-aware size expressions,
   text/symbol counts and general filters are further layer work.
5. Pick generated clusters with synthetic feature ID cluster:<native ID> and
   standard cluster/cluster_id/point_count properties. IDs are scoped to a native
   index lifetime; never promise stability across replacement or style reload.
6. Add a deterministic dev fixture: duplicate-coordinate pair near Gdansk and
   a separated point. Verify low-zoom count/membership via picking and separation
   above maxZoom on both simulators, plus revision rejection and style replay.
7. Run contract/type/Codegen checks, native builds, bundles and review. Update
   CLUSTER statuses from evidence, keeping required unfinished work explicit.

Subsequent required work remains children/leaves and expansion queries with
stale-index handles and bounded results, property aggregation, dense/overlapping/
antimeridian membership fixtures, background processing and cancellation/memory
limits, 1k/10k/100k release-device benchmarks, and accessible cluster semantics.
Existing 10000-feature/source limits are not evidence for 100000-point support.
Do not mark the clustering workstream complete from the first slice.

Preserve the dirty shared worktree; no commits or publishing.
