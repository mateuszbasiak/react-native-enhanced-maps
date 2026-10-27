# Component cluster simulator acceptance

Bounded Debug verification on 2026-10-23 used iPhone 17 Pro / iOS 26.1 and
Pixel 9a ARM64 / Android API 36, React Native 0.85.3 and the pinned native SDKs.
The fixture uses `Marker.cluster`, a custom React cluster child, lazy `getMembers`
and the default count bubble. It does not use retired public source-query APIs.

Later [maximum-zoom and overlapping-group checks](cluster-zoom-acceptance.md)
record additional bounded acceptance.

Both hosts passed these deterministic coincident-point scenarios:

- 3, 1000 and 10000 participating markers produce the expected cluster count.
  Lazy membership contains every expected unique `vessel-N` ID and matching
  application-owned name/status metadata. The three-member set was inspected
  through the actual child handler on iOS and through the same public handle on
  Android; larger audits use the Debug harness.
- Updating the source invalidates a previously captured handle with
  `Cluster is obsolete`. Style replacement and map remount restore the cluster
  and reject previously captured handles. Android re-audited all 10000 members
  after each style/remount operation.
- Moving the three participating coordinates at zoom 12 updates the published
  coordinate from longitude approximately 18.66 to 18.68 on both hosts.
- The default accessible count button expands from zoom 12 to 15 and exposes
  the individual marker children. Native accessibility discovery confirms all
  three children when clustering is disabled. This is not screen-reader acceptance.
- The independent marker remains pressable and its child handler updates the
  status to `Independent marker selected` on both hosts.

The Debug global `__enhancedMapsClusters` exposes configure, snapshot, capture,
inspect, animate, reloadStyle and remount. `inspect(expectedCount)` waits up to
15 seconds for a matching custom child and rejects after fixture disposal. It
then invokes that child's public lazy membership method. Capture deliberately
retains an old handle so tests can check rejection after updates.

An initial Android 10000-member probe ran before a custom child mounted. It was
recorded as a failed early query, then repeated successfully after adding explicit
expected-count readiness. It is not counted as a native clustering failure or a
performance result.

The implemented component clustering flow is complete for the supported behavior
verified above. Additional spatial/antimeridian and zoom-boundary fixtures,
overlapping clusters, stale in-flight native work, visible output/index-memory
bounds, background cancellation and repeated stress remain separate work under
CLUSTER-06/07. Physical-device Release latency/performance and device accessibility
checks are deferred to the maintainer and do not block this feature's completion
or PR readiness. No physical-device results are claimed. These recorded runtime checks cover up to 10000 clustered markers. The count cap
has since been removed; no larger-count runtime or performance result is claimed.

## Cluster participation handover — 2026-10-27

Disabling clustering could crash React rendering with `Cannot read property
'sourceId' of undefined`. During the render that schedules a marker-version
update, the old revision still matched an accepted native layout even though
current marker groups had already changed. Layout rendering now requires the
current content signature as well as style and source revisions to match.

A host regression models this pending render-phase update, group replacement,
style invalidation and the subsequently accepted layout. Both iPhone 17 Pro/iOS
26.1 and Android 16/API 36 ARM64 completed five clustered/unclustered cycles and
returned all three expected member IDs after every re-enable, without a render
error. These are bounded functional checks of the JavaScript lifetime guard,
using compatible native Debug hosts; no native implementation changed.
