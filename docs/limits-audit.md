# Limit audit — 2026-10-29

This is a source review of application-facing limits in the JavaScript compiler,
native scene/query/snapshot paths and shader contract. Recommendations describe
the reviewed baseline; see the implementation update below. The original audit
included no performance measurements or new native acceptance runs. A numerical guard is not evidence of an SDK requirement.
Generated files, dependency internals and test fixture sizes are outside scope.

## Limits worth removing or replacing

- **64 non-point Geojson shapes** (`src/geojson.ts`, `expandGeojson`): a leftover
  count policy alongside 10,000 features, positions and output elements, and 50,000
  geometry entries. Ordinary shapes already batch and use the 4 MiB scene budget.
  Remove the 64-shape cap first; replace the other geometry/output counts with an
  incremental expansion budget. Do not simply remove every input guard: expansion
  creates React elements and intermediate arrays before final scene serialization.
  Validate MultiPolygon expansion, large inputs and recoverable byte-budget errors.
- **64 marker cluster groups** (`src/markerClustering.ts`): each group adds a
  source/layer, but the general source/layer caps have been removed. There is no
  distinct SDK justification in this guard. Remove it, preserving scene bytes;
  test 65 groups, group updates and native resource replacement. A measured
  resource budget may still be useful for very many separate indexes.
- **50,000 heatmap points** (`src/heatmap.ts`): not an SDK requirement established
  by this code. Prefer incremental serialized-byte accounting, including generated
  feature IDs and properties. Check whether a >50,000-point fixture actually fits
  the 4 MiB transport before claiming a larger supported size.
- **128 polygon holes** (`src/mapContent.ts`, `holes`): overlaps the geometry byte
  bound. Replace with incremental geometry accounting; test >128 small holes and
  malformed rings. Hole topology and picking correctness remain independent.
- **1,000 explicit fit coordinates** (`src/cameraFit.ts`, native `NativeCameraFit`):
  bounds fitting has a real CPU/transport cost, but 1,000 is a policy choice.
  Replace with an explicit request-byte/work budget applied in JS and both hosts.
  The generic native query envelope is 65,536 UTF-8 bytes; lifting only the count
  can merely move failure to that boundary. Test large routes and dateline fits.
- **2 MiB legacy content serializer** (`src/mapContent.ts`, `serializeMapContent`):
  counts UTF-16 code units, despite the error saying MiB. Production scene assembly
  uses `serializeMapScene`; confirm remaining consumers before deleting this
  helper or align its contract with the shared UTF-8 budget.

## Keep protection; reconsider the chosen number

- **4 MiB scene/source transport** (`src/sceneBudget.ts`, `src/layers.ts`, both
  native hosts): keep a finite bound. JSON parsing, retained copies, synchronous
  Android tiling and full scene replacement consume CPU/memory. The exact 4 MiB
  value is a conservative policy, not measured maximum scene capacity. Any tuning
  needs peak-memory and UI-thread measurements, not just a passing large fixture.
- **Property complexity** (`src/layers.ts`, `src/geojson.ts`): depth 16,
  65,536 versus 100,000 visited values, 1 MiB string characters. Keep bounded
  traversal and cycle/depth protection: the final byte check occurs too late to
  protect recursive preprocessing. Reconcile the two contracts and use explicit
  byte/node terminology. These limits can reject a scene below 4 MiB.
- **React nesting 32** (`mapContent`, `maplibreContent`, `markerClustering`,
  `calloutContent`, `layers`): keep recursion protection for now. An iterative
  traversal plus a work budget is a better route to supporting deep wrappers.
- **8 image overlays** (`src/maplibreContent.tsx`, native scene validators): keep
  temporarily. Scene JSON bytes do not bound remotely decoded image memory; eight
  huge images can already exceed a sensible memory budget. Replace the count with
  decoded-pixel/byte accounting, loading concurrency and cancellation. Raising the
  count alone does not address the actual resource risk.
- **Query broker 32 pending / 5-second deadline** (`src/mapQueries.ts`): keep
  bounded outstanding work and expiry. Exact values are tuning choices; expose or
  derive a deadline if legitimate operations exceed it. Snapshot work has its own
  4-second native deadline, leaving little scheduling margin. Test cancellation,
  map/style replacement, overload rejection and slow successful requests.
- **Cluster pages 100 / response 256 KiB** (`src/clusterQueries.ts`, native query
  helpers): keep pagination and response-byte bounds. Public `getMembers()` already
  walks pages; 100 is not a total cluster-membership limit. Tune page size only
  with serialization/latency evidence and update producer and decoder together.
- **Snapshots 4,096 per axis / 16 million pixels / 32 MiB encoded**
  (`src/snapshots.ts`, native `MapSnapshot`): retain allocation and encoding bounds.
  Sixteen million RGBA pixels alone occupy about 64 MB, before intermediate
  captures and base64. The per-axis bound may eventually follow actual platform
  capability. Android additionally bounds the mounted viewport and attribution
  text to 8,192 characters; verify large-viewport parity before broadening support.
  Cache retention of 16 files and age-based cleanup are disk policies, not capture
  capabilities; document file lifetime rather than silently promising persistence.
- **Styles** (`src/mapContent.ts`, `heatmap.ts`, native `SceneValidation`): widths
  and point radii 256, miter limit 1,000, dash count 32 and lengths 10,000,
  heatmap radius 10–50, weight 1,000,000, authored gradient colors 256 and generated
  colors up to 1,024 are product policies. Preserve finite numbers, nonnegative
  dimensions, opacity in [0,1] and ordered gradient stops. Relax cosmetic maxima
  only with matching native validators and rendering fixtures; a 10-pixel minimum
  heatmap radius especially deserves a concrete compatibility rationale.
- **Circle 1,000 km / fixed 128 segments; geodesic 0.25-degree steps**
  (`src/mapContent.ts`, `src/geodesic.ts`): these are geometry/quality policies.
  Prefer an error-tolerance-driven tessellator under the shared byte budget.
  Larger circles need geographic/topology checks, not just a larger radius bound.
- **Camera animation 60 seconds / padding 100,000 points** (`src/cameraFit.ts`,
  `src/rnMapsCompat.ts`, `src/mapSettings.ts`, native hosts): policy choices.
  Keep finite, nonnegative values and safe native conversions; assess long-running
  animation cancellation and viewport-relative padding validation before relaxing.
- **Identifiers/text/URLs**: resource IDs 128, feature/marker/group IDs 512,
  color strings 256, callout text 4,096, image/tile URLs 4,096 and encoded local
  tile URIs 4,088. These are package framing policies, not proven universal SDK
  maxima. Keep validation and aggregate byte bounds; lengthen only for demonstrated
  consumers. URI encoding expands paths, so the local URI check can reject a
  shorter Unicode path. Preserve arbitrary Unicode marker identity semantics.
- **Location freshness** (native location helpers): age windows prevent stale
  cached fixes being presented as current. Keep freshness semantics; configurable
  age and explicit stale status are preferable if navigation consumers need them.

## GPU limits need capability and workload budgets

`src/shaderContract.ts` and `src/shaderViewport.ts` impose several independent
policies. Retain bounded allocations/work; do not remove them as a group.

- 1,048,576 grid nodes packs to 16 MiB at four float32 values per node. The packing
  relationship is real; the allowed total is policy and JS intermediates add cost.
- 1,024 uniform floats, 16 MiB simulation storage and 256 Ki characters per shader
  are package budgets. Derive supported buffer sizes from the active GPU device
  while retaining application budgets for compilation and retained memory.
- 1,048,576 vertices/instances individually and 6,291,456 combined are workload
  caps. They cannot guarantee frame time for arbitrary shaders. Treat them as
  conservative defaults, with measured opt-in increases if needed.
- At most three dispatch dimensions matches the API shape. The product limit of
  65,535 workgroups is an additional package policy; distinguish it from per-axis
  capability validation. A dispatch budget also needs shader workgroup size.
- Resolution scale 0.25–1 disallows both more aggressive downsampling and
  supersampling. Prefer output-pixel and device texture-dimension budgets.
- The 4,096 guard-band dimension and world bounds [-3,4] are conservative coverage
  policies. Derive texture dimensions from actual capability and test wide,
  rotated, high-pitch, multi-world viewports before changing coverage.
- Float32 range, 16-byte buffer alignment and fixed frame layout are representation
  contracts. Preserve them unless the shader ABI itself changes.

## Preserve correctness boundaries pending explicit feature work

Finite numeric inputs, dense coordinate arrays, ring closure, unique IDs, safe
integer request/revision counters, supported geometry kinds, reserved cluster
properties, positive sizes and opacity/quality ranges protect semantics.

Latitude ±85 for public shapes differs from the Mercator cutoff
±85.0511287798066 and ordinary GeoJSON ±90. The extra margin is conservative;
removing latitude checks would break projection/geodesic assumptions. Consider
unifying the supported projected latitude only with polar fixtures.

Map zoom 0–24, tile zoom 0–22, tile sizes power-of-two 64–1,024, cluster radius
1–512 and clustering zoom 0–17 are pinned integration contracts in this package.
Their presence in validators does not prove every endpoint is a hard SDK maximum.
Check the pinned native implementation and run cross-platform boundary fixtures
before widening. Existing cluster defaults (radius 50, zoom 14, minimum count 2)
are defaults, not dataset capacity limits. Native integer bounds must remain.

## Documentation and next implementation order

The current opening of `scene-budgets.md` correctly states that general scene
source/layer and position-count caps were removed. Its dated sections preserve
historical 64/128 and 10,000/50,000 results; do not read those as current limits.
`README.md` still advertises shared 64-source/128-layer caps and needs correction.
`clustering.md` omits the still-enforced 64-group restriction.

Recommended sequence: remove redundant shape/group/hole counts with focused
regressions; replace Geojson/heatmap/fit input caps with incremental budgets;
reconcile documentation and JS/native budget units; then measure image, snapshot
and GPU resource costs before tuning those bounds. Runtime changes should include
boundary acceptance, malformed input rejection and preservation of the last valid
native scene. This audit alone does not establish safe unbounded operation.

Source paths above are relative to `packages/maps/`, except repository docs.

## Implementation update — 2026-10-29

During PR preparation, main had advanced through #95, independently removing the
64-shape, 64-group and 128-hole caps along with general scene-byte and dataset caps.
Those changes are preserved. The audit above describes the older checkout and
must not be used as the current API contract.

This PR adds an operation-specific 4 MiB generated Heatmap FeatureCollection guard
with incremental UTF-8 accounting, plus incremental 64 KiB explicit-fit coordinate
JSON accounting and full UTF-8 request-envelope checks in JS and both native hosts.
It also rejects unsafe integer cluster-group source suffixes while accepting groups
above 64. No general scene or polygon-hole byte cap is restored.

Validation includes repository checks and an iOS Foundation harness exercising the
production fit helper with a minimal MapLibre view stub. Prior isolated Android
compilation used cached MapLibre 13.6.1 and Android 36 with a marker-view model
stub. Full native application rebuilds and simulator interaction were not performed.
