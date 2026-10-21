# Cluster inspection implementation plan

Goal: complete children/leaves/expansion inspection with bounded results and
protection against stale or foreign native indexes.

Design: expose opaque, immutable ClusterHandle values on structured cluster hits
and child results. A per-MapView WeakMap owns handles; forged/copied/foreign-map
handles reject before dispatch. Handles carry private native index and style
revisions. Increment native index revision before any source-scene mutation,
including failed partial mutation, so old handles cannot access replacement
indexes. Native query handlers validate the current revision and clustered source.

Public methods: getClusterChildren(handle, page?), getClusterLeaves(handle, page?)
and getClusterExpansionZoom(handle). Page defaults limit 100/offset 0; limit 1–100,
offset 0–10000. Results include total, offset and features with point coordinates,
SDK properties and optional child cluster handles. Results and nested data are
immutable. Leaves use SDK pagination; children paginate the bounded SDK child
list (source remains limited to 10000 points). No full index is sent to JS.

Reuse the 32-pending/5-second query broker and style/unmount/fatal cancellation.
Geometry results retain 2048 characters; cluster pages have an independent 256KiB
UTF-8/character ceiling, 100 features and bounded property nesting/node count.
Oversized pages reject rather than truncate. Caller may reduce page size.

Steps:

1. Failing registry ownership, paging, stale style and malformed-result tests.
2. Public types, native event index revision and shared broker result parsing.
3. Native source revision counters and SDK inspection/serialization on both hosts.
4. Dev controls inspect tapped clusters, paginate leaves, inspect children and
   expansion, and retry held handles after replacement/style/remount.
5. Verify known leaf IDs/counts and stale rejection on both simulators; run
   contracts/types/Codegen/native builds/bundles and code review.
6. Update checklist and evidence. Keep aggregation, background/memory limits,
   complete edge fixtures and release-device benchmarks explicitly open.
