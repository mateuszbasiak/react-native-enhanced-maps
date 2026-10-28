# Component cluster spatial and antimeridian acceptance

Checked on 2026-10-28 against main `a11b9fd` with the Debug verification additions
in this change. No public clustering API or native clustering algorithm changed.

The dedicated targets were an iPad Pro 13-inch (M5), iOS 26.4, and Small_Phone,
Android 17/API 37 ARM64 with 16 KB pages. Both ran the package-owned Debug hosts
with bundle/application ID `com.enhancedmapsexample.clusters` on isolated Metro
port 8094. The pinned MapLibre baselines remain iOS 6.31.0 / Android 13.6.1.

## Cases and assertions

Both hosts passed seven cases using twelve public Marker children:

1. Four three-member islands on opposite sides of the equator and prime meridian
   at zoom 8. Exact counts and memberships survive spatial tile boundaries.
2. Points near +179.8/-179.8 longitude viewed from the east at zoom 5.
3. The same points viewed from the west, without rebuilding the source.
4. Low zoom in landscape, centered on longitude 0, with more than one world width visible. Dateline markers appear near both edges, exposing repeated copies of their anchors. Layout/world-copy
   deduplication retains every member exactly once.
5. Separate moving/moored groups at the dateline, with memberships isolated by
   group even where children overlap geographically.
6. Style replacement, followed by complete membership recovery.
7. Map remount, followed by camera positioning and complete membership recovery.

Each record contains all member IDs, original coordinates and metadata, cluster
counts/coordinates/groups, authoritative camera and map dimensions. Assertions
require the exact twelve-ID union, no repeated member, count agreement, original
metadata/coordinates and expected group routing. Three consecutive matching
observations are required after each transition. Fixture island centroids allow
0.001 degrees for native index quantization; SDK cluster IDs and ordering are not
required to match. Source replacement also rejects a captured obsolete handle.

Observed partitions matched across hosts: spatial islands 3/3/3/3, dateline sides
6/6, and grouped dateline 2/4/4/2. Style and remount records retain those memberships.
The iOS landscape map was 1376 by 871 logical points; Android was 640 by 225.
The low-zoom assertion uses actual zoom and requires width greater than
`512 * 2 ** zoom`. Portrait iPad zoom 0 was constrained by the SDK to about 1.25;
that earlier run did not establish multiple-world coverage and was excluded.

## Repeatable verification

Launch the Debug app on a dedicated Metro port and set the devices to landscape.
Use the matching logical device ID from that Metro's `/json/list`:

```sh
METRO_PORT=8094 npm run verify:rn-maps -- --clusters <logical-device-id>
```

The runner selects a fresh clustering scenario, invokes the verifier compiled in
the Debug bundle, and validates every returned record again in Node. Results go
to ignored `artifacts/rn-maps-parity/clusters-{ios,android}.json`. Preserved local
receipts are under `artifacts/verification/cluster-spatial/`.

The assertion tests deliberately corrupt missing/duplicate members, counts,
metadata, member/cluster coordinates, groups, viewport/camera values and empty or
partial records. An initial CDP-evaluated async verifier returned null records and
was rejected as acceptance evidence. Executing the verifier from the Debug bundle
and checking structured receipts avoids treating that debugger behavior as a pass.

## Limits and separate failures

These are bounded functional checks, alongside the existing
[1k/10k component audits](component-cluster-acceptance.md) and
[maximum-zoom/overlap checks](cluster-zoom-acceptance.md). They do not measure
visible-output bounds, index memory, cancellation latency or large spatial-dataset
performance. Those remain under CLUSTER-06. Physical-device measurements and
screen-reader matrices remain maintainer-owned follow-up.

The Android 16 KB target displayed a compatibility warning identifying the owned
`libem_shader_layer.so` LOAD alignment. ELF inspection confirmed 4096-byte LOAD
alignment for that library; the checked MapLibre and Hermes libraries use
16384-byte alignment. The clustering checks ran in the system's
page-size compatibility mode; this is not proof of native 16 KB binary support.
A Hermes SIGSEGV during the initial CDP-evaluated run is preserved separately and
was not counted as passing evidence. Native alignment and debugger diagnosis must
remain distinct from these successful component-membership assertions.
