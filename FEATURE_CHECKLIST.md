# Project checklist

Last reviewed: **2026-10-25**, against the current working tree.

Package-owned MapLibre Native on iOS/Android, React Native New Architecture only.
The public API is component-based: `MapView`, `Marker`, `Polyline`, `Polygon`,
`Circle`, and experimental `ShaderLayer` through `/shaders`. Sources and style
layers are internal infrastructure; marker clustering replaces the former public
source-oriented clustering API. See the [clustering contract](docs/clustering.md)
and [current exports](packages/maps/src/index.ts).

Layers, native clustering, native gestures and portable custom GPU shaders remain
required v1 work. Removing a retired API does not close its underlying quality gate.
The exact remaining layer surface needs reconciliation with the component direction.

Use this file for remaining work. Keep detailed contracts in `docs/` and results in
[verification](docs/verification.md). A feature is complete when its agreed behavior
is implemented and relevant automated checks plus feasible build/simulator checks
pass. Physical-device validation is not required to mark a feature complete; the
maintainer will test devices and make any needed tweaks later. Track additional
validation separately from implementation gaps. Never claim unmeasured hardware
results. Distribution/publishing approval remains separate. Existing IDs are retained
where useful (combined IDs share one task); retired IDs must not be reused.

## Implemented foundation

- [x] Mounted snapshots and native marker dragging — PNG/JPEG file/base64 captures with explicit composition/size limits, native long-press dragging, coordinate callbacks and cancellation. [Contract](docs/location-snapshots-dragging.md).

- [x] RN Maps common API migration surface — Regions/controlled camera, partial updates, native region events, ordered camera/geometry reads, fit/bounds aliases, nativeEvent presses, optional marker identifiers, image/default pins and centerOffset. Native builds and both simulator runtime suites pass; full provider parity remains separate. [Migration guide](docs/rn-maps-migration.md).

- [x] **ARCH-01–06, MAP-13** — Workspace, package-owned Fabric hosts, pinned baseline dependencies, declarations, Codegen, autolinking and packed-consumer checks.
- [x] **ARCH-07** — Revision-scoped native capability reports; layers and shaders remain unvalidated. [Capabilities](docs/capabilities.md).
- [x] **CAM-01–02** — Validated mount-only initial camera and imperative `animateCamera`, with rejection before readiness.
- [x] **SRC-03** — Internal source revisions reject stale replacements and preserve accepted scenes. [Contract](docs/source-revisions.md).
- [x] **SHAPE-01** — Polygon, Polyline and geographic Circle with stroke styling and typed presses. [Shapes](docs/shapes.md).
- [x] Polygon-hole fill picking — Native filtering preserves lower-layer/map fall-through and outline presses on both simulators. [Results and limits](docs/polygon-hole-picking.md). Broader shape/picking coverage remains below.
- [x] **GEST-04, PICK-01** — Confirmed map tap/long-press and structured native feature routing; component callbacks remain public. [Map presses](docs/map-presses.md), [picking internals](docs/feature-picking.md).
- [x] **TEST-01–02, TEST-04** — Contract/native-helper tests, production bundle and package checks, and development/build commands exist. These do not replace native runtime acceptance.

- [x] Repeated lifecycle verification harness — Both simulators pass 100 strict remount/readiness/stale-ref/native-bounds cycles, with bounded results and cancellation checks. [Results and debugger limitation](docs/map-lifecycle-acceptance.md). Broader lifecycle/resource coverage remains below; physical-device validation is maintainer-owned follow-up.
- [x] Shape color strings — Polyline/Polygon/Circle accept the pinned React Native string forms and normalize them before native transport. Contract/package/bundle checks and Debug simulator rendering/press smoke pass. [Contract and results](docs/shapes.md).

- [x] Geodesic shape edges — Opt-in Polyline/Polygon great-circle geometry, holes, dateline continuity, angular subdivision and point limits are implemented. Compiler contracts and both simulators verify geometry/rendering and route presses. [Results and subsequent hole-picking fix](docs/shapes.md).
- [x] Polyline gradient strokes — Per-original-vertex colors interpolate along native line distance, including geodesic subdivision. Contracts and both Debug simulators verify updates, solid fallback, remounts and presses. Gradient/dash combinations reject explicitly. [Contract and results](docs/shapes.md).
- [x] Debug scenario sessions — Single-scenario selection, committed-generation readiness, bounded immutable records, explicit timeout/cancel/failure/skip and provenance fields. Broader semantic/visual/trace automation remains below. [Contract](docs/scenario-sessions.md).
- [x] Bounded shader device recovery — Unexpected loss gets at most two serial replacements after cleanup; disposal cancels retries. Contracts and both Debug simulators verify injected recovery/exhaustion, produced/sampled output and zero final pools. [Policy and bounded results](docs/shader-layer.md).

## Map lifetime, camera and gestures

- [ ] **MAP-07–09, MAP-12** — Verify mount/teardown, resize/rotation, background/resume, navigation, multiple maps, interrupted initialization and style/tile/network failure recovery. Both simulators passed [100 bounded remount/readiness/query cycles](docs/map-lifecycle-acceptance.md). Android now gates native rendering on independent host/window state, with terminal disposal and native transition regressions. Complete memory/resource counts and the remaining lifecycle/failure matrix.
- [x] **MAP-10** — Supported native map settings are implemented: pan/zoom/rotate/tilt toggles, compass visibility, zoom limits and persistent padding. Relevant contracts, builds and simulator checks pass. [Settings](docs/map-settings.md), [padding](docs/map-padding.md). Broader lifecycle/accessibility checks are separate validation follow-up.
- [x] **MAP-11** — Native Debug/Release builds and Release simulator smoke pass on both hosts. Physical-device smoke is maintainer-owned deferred follow-up. [Packed consumer evidence](docs/native-consumers.md).
- [ ] **CAM-04, CAM-06, CAM-08** — Complete idle/origin, animation completion, exact no-op, interruption, SDK-control and disposal matrices. Simulator app/gesture/compass cases are recorded in [camera origins](docs/camera-origins.md).
- [ ] **CAM-07, CAM-11** — Controlled camera/region and precedence are implemented with serialized partial updates and obsolete-request guards. Broaden interruption, feedback-loop and event-volume acceptance. [Migration contract](docs/rn-maps-migration.md).
- [ ] **CAM-09–10** — Complete geographic, high-pitch, padding, resize, animation and lifecycle coverage for projection, visible bounds and fit methods. Explicit fit request validation now rejects sparse coordinate arrays before native dispatch, with host regression coverage. Both simulators have bounded round-trip/dateline/fit evidence. [Geometry contract](docs/map-geometry.md).
- [ ] **GEST-01–03, GEST-06** — Complete native pan/zoom/rotate/tilt provenance, throttling, simultaneous recognition and cancellation under detach/navigation/stress. Background cancellation and subscription cycling have simulator evidence. [Gestures](docs/gestures.md).
- [ ] **GEST-05, A11Y-05** — Marker touch ownership and hit order under multi-touch, nested scroll, bottom sheets, navigation, multiple maps and GPU touch-through. [Marker gestures](docs/marker-gestures.md).

## Markers, shapes and internal rendering

- [ ] **COMPAT-03–04, COMPAT-10–11** — Verify React marker child updates, overlap/zIndex, selection, accessibility, lifecycle and Android texture/coordinate alignment. Image/default pins and marker presses are implemented; native dragging is implemented; callout APIs remain open. [Marker sync evidence](docs/marker-coordinate-sync.md).
- [ ] **SHAPE-02, LAYER-02, LAYER-04–05, LAYER-10–11** — The reproduced pinned-SDK fill-query hits inside polygon holes are fixed; complete geometry/style replacement, visibility, insertion/draw/hit order, antimeridian and cross-platform semantic fixtures for internal circle/line/fill rendering and public shapes. [Native fix and remaining geometry limits](docs/polygon-hole-picking.md).
- [ ] **SHAPE-03** — React Native color strings, geodesic Polyline/Polygon edges (including holes) and per-vertex Polyline gradients are implemented. Decide remaining dash-phase compatibility. [Shapes](docs/shapes.md).
- [ ] **LAYER-03, LAYER-06–09, SRC-02** — Reconcile required symbol/icon, raster/tile, heatmap, expression/filter and zoom-range work with the component-only API before implementation. Existing literal styles and scene rebuilds are only a subset; do not restore the retired public `Layer` API by assumption.
- [ ] **SRC-04, SRC-07, ARCH-09** — Measure parsing/rebuild cost; design incremental updates, off-UI-thread work, cancellation and bounded queues where needed. Android currently uses synchronous source updates for alignment.
- [ ] **SRC-05–06** — Host-side GeoJSON validation rejects sparse coordinates at every geometry depth. Both native hosts now enforce source framing/geometry and aggregate position limits before SDK parsing or accepted-scene replacement, preserving generated world-copy geometry. [Native preflight](docs/scene-budgets.md#native-geojson-preflight--2026-10-27) covers 122 shared native fixtures and both simulators' raw-transport rejection/preserved fitting/picking/corrected replacement checks. The [polygon-helper corpus](docs/polygon-hole-picking.md#shared-native-helper-corpus--2026-10-25) covers matching C++/Java hole/boundary/winding/world-copy/high-latitude cases. Complete native layer/style/property-complexity handling and broader geographic rendering/picking acceptance. Existing 4 MiB scene bounds remain in force.
- [ ] **PICK-02–03, PICK-05** — Complete visibility/overlap and marker/shape/cluster routing coverage, hit-test cost and accessible alternatives; decide public hit-radius/multiple-hit requirements.

## Native marker clustering

Current implementation compiles opt-in `Marker.cluster` children into a private
MapLibre index, renders default/custom React cluster children, and exposes lazy
membership and expansion through cluster component props. Public marker IDs retain
Unicode, generated paths and `cluster:` prefixes through membership and layout;
both simulators have boundary-ID membership and prefix-marker selection evidence.
Source query APIs and their old fixtures describe internal/historical behavior,
not the current public API.
[Contract](docs/clustering.md), [implementation](packages/maps/src/markerClustering.ts),
[regressions](tests/marker-clustering.test.mjs).

- [x] **CLUSTER-01–05** — Component clustering is implemented and verified on both simulators: custom/default children, count/coordinate, lazy 3/1k/10k membership/metadata, expansion, opt-out markers, updates and stale handles after style reload/remount. [Results](docs/component-cluster-acceptance.md). Additional in-flight/overlap, resource and stress coverage remains under CLUSTER-06/07; physical-device checks are maintainer-owned follow-up.
- [ ] **CLUSTER-06** — Bound native/React visible output, index memory and background/cancellation behavior.
- [ ] **CLUSTER-07** — Port membership audits to the component API and add overlap, zoom-boundary and antimeridian fixtures. Both simulators passed complete component 1k/10k coincident-point membership/metadata audits; spatial parity remains open.

## Portable custom GPU shaders

The current path is [ShaderLayer](docs/shader-layer.md): one WGSL program set on
both platforms, optional compute/storage, packed uniforms, world Mercator tiles,
a dedicated Worklets runtime and shared native viewport leases without pixel readback.
Recorded simulator publications during main-JS stalls demonstrate scheduling
independence. Android software-adapter diagnostics do not prove hardware acceptance.

- [ ] **GPU-05–08, GPU-18** — Quantify projection/alignment during pan, zoom, rotation, high pitch, padding, resize and animation; cover high zoom, wrapping, horizon gaps and viewport resolution changes. Planar Mercator/polar limits must remain explicit.
- [ ] **GPU-09** — Stabilize the experimental WGSL/input/resource contract. Decide schema-typed authoring and streamed texture requirements separately from current packed uniforms/storage.
- [ ] **GPU-10–11** — Evaluate native-fence handoff beyond current GPU-queue completion waits as a separate optimization. Physical-device scheduling, frame-age, backpressure, allocation and energy measurements are maintainer-owned deferred follow-up.
- [x] **GPU-12** — Bounded recovery, repeated loss/show-hide/remount stress, failed edits, pause/background/resume, style replacement, concurrent maps/layers and disposal are implemented and verified. [Lifetime evidence](docs/shader-lifetime-acceptance.md) covers native worker/device reuse and repeated stress; [clock and interruption acceptance](docs/shader-lifecycle-acceptance.md) adds both simulators' 100 interrupted initializations, seven controlled async boundaries, double-cleanup ownership and zero final output pools. Native allocation accounting and physical-device performance remain separate follow-up under PERF/GPU-15.
- [ ] **GPU-13–14** — Validate capability/error degradation and composition limits, including label placement, controls/attribution and native marker ordering. Capability reports currently mark shaders unvalidated.
- [ ] **PICK-04** — Decide GPU picking and ordering relative to ordinary content; supply interaction alternatives for visual-only effects.

## Reliability, performance and verification

- [ ] **ARCH-08** — Consistent recoverable/fatal errors across map, source, command and GPU failures.
- [ ] **PERF-06–07, PERF-10** — At least 100 lifecycle cycles, memory drift/resource bounds, large-content update/cancellation cost, poor-network/offline behavior, memory pressure and GPU failure resilience.
- [ ] **PERF-08** — [Repeatable consumer footprint tooling](docs/consumer-footprint.md) measures the maps tarball, installed dependency payload and comparable core/core-plus-shader production JS bundles. Complete native app binary sizes and clean/incremental build cost; npm file payload is not native binary overhead.
- [x] **TEST-03, TEST-10** — Remote main and PR package CI jobs, 128 passing tests, Codegen, packed declarations, both production bundles and uploaded artifacts are verified for the [recorded commits/runs](docs/remote-ci-acceptance.md). Later revisions need fresh CI results. Native CI builds were intentionally removed in PR #13; native build/runtime acceptance remains separate.
- [ ] **TEST-05–09, TEST-11** — Debug selection/readiness collection and provenance records are implemented. Complete consolidated semantic assertions, pass/fail results, controlled visual baselines, alignment and trace capture. [Session contract](docs/scenario-sessions.md). Unavailable devices must not count as passes.
- [ ] **TEST-12** — Production example and optional-peer bundle verifiers reject Debug globals and configured local maps secrets without printing bundle contents. [Scope and evidence](docs/verification.md#release-bundle-secret-exclusion-2026-10-27). Complete broader Release consumer diagnostic/privacy acceptance; this is not arbitrary credential discovery or a native binary/log audit.
- [ ] **A11Y-01–03, A11Y-06** — VoiceOver/TalkBack acceptance for markers, clusters and shapes, accessible navigation/selection, reduced motion and shader pause alternatives. iOS child-label/frame fixes have bounded simulator evidence only.

## Compatibility and distribution

- [ ] **COMPAT-01–02, COMPAT-05–06, COMPAT-08–09** — Pin RN Maps and document supported/partial/unsupported APIs with equivalent fixtures and migration examples. Current familiar component names do not promise full parity; include camera/bounds/snapshot/helper gaps.
- [x] **COMPAT-07** — Native/app-owned foreground user location, following, permission ownership, recoverable denial and lifecycle behavior are implemented. [Contract](docs/location-snapshots-dragging.md). Broader accessible tracking acceptance remains under A11Y-04.
- [ ] **ARCH-11, REL-07** — Freeze supported OS/RN/SDK ranges from evidence; document upgrades, migration and known limits.
- [ ] **REL-01, REL-08** — Resolve package ownership, repository metadata, license, SDK attribution and dependency/distribution requirements. Packages are currently private and UNLICENSED.
- [x] **REL-02** — Packed core bare consumers pass Debug/Release builds, declarations, autolinking and Release simulator startup outside the workspace. [Results and resolver workaround](docs/native-consumers.md). Physical/signed-device checks are maintainer-owned follow-up.
- [ ] **REL-05** — The [optional-peer consumer matrix](docs/optional-peer-consumers.md) covers isolated normal-npm installs, packed declarations and iOS/Android production bundles with neither peer, either peer alone and both. Complete GPU-enabled native consumer Debug/Release builds and runtime acceptance; bundle-only success without Worklets is not shader support. Core packed integration is complete under REL-02.
- [x] **REL-04** — Expo SDK 56 config plugin and isolated packed core consumer pass repeated prebuild, iOS/Android Debug/Release builds and simulator rendering/marker presses. Release starts with the Expo Metro server stopped. [Setup and results](docs/expo.md). Expo Go is outside the target; physical-device checks are maintainer-owned follow-up.
- [x] **REL-06** — Current installation, API, capability and component-clustering references match public exports. Source/layer transport is explicitly private; prototype/provider scenarios are historical. Canonical repository links and the fixed hole-picking status are reconciled. [Documentation index](docs/README.md).
- [x] **REL-09–10** — Changelog/versioning, prerelease/provenance/credential policy, bug/security reporting and maintenance policy are documented. [Release policy](docs/release-policy.md). Ownership, licensing and publishing approval remain under their own IDs.
- [ ] **REL-11** — Validate npm prerelease and obtain explicit publishing approval.

## Future discovery (outside accepted v1 scope)

- **DISC-01–04** — Mapbox gap inventory; vector tiles, feature state/transitions, richer data-driven styling and advanced text/sprites/fonts beyond the agreed initial scope.
- **DISC-05, DISC-07** — Terrain, extrusions, globe/3D and offline datasets/downloads, with technical and licensing constraints.

Additional/custom sources need explicit contracts. Legacy React Native architecture
and alternative native module architectures remain outside the agreed target.
TurboModules should be added only when a concrete non-view operation needs one
(former ARCH-10), rather than as a standalone feature.

## Release gates

These distribution/acceptance checks are separate from feature completion.
Deferred physical-device checks are owned by the maintainer, below.

- [ ] **GATE-01** — Measured projection, composition, threading and lifetime paths for MapLibre, required layers and portable shaders on both platforms.
- [ ] **GATE-02** — Approved camera, component/rendering, cluster, capability, error and compatibility contracts.
- [ ] **GATE-03** — Required v1 functionality with acceptance coverage on both platforms.
- [ ] **GATE-05** — Clean bare/Expo consumers, public documentation, SDK integration, licenses and package ownership resolved.
- [ ] **GATE-06** — Remaining limitations accepted and publishing explicitly authorized.

## Maintainer physical-device follow-up (deferred)

These checks do not block feature completion or feature PR readiness. The maintainer
will perform them later and make any resulting tweaks. They are not recorded as passes.

- [ ] **CLUSTER-08, SRC-08** — Deterministic release-device 1k/10k benchmarks, update latency and cross-platform semantics. Evaluate 100k separately: the current clustered-marker/source limit is 10k.
- [ ] **GPU-15** — Physical-device Release frame time, alignment, memory, dependency-size and build-cost budgets.
- [ ] **PERF-02–05, PERF-09** — Choose physical reference devices and numeric budgets; compare equivalent native-only/pinned RN Maps scenarios. Measure frame-time percentiles, dropped frames, UI responsiveness and busy-JS behavior with repeatable artifacts.
- [ ] **GATE-04** — Physical-device Release performance, stability, accessibility and size budgets pass.
- [ ] **GPU-10–11 measurements** — Physical-device scheduling, frame age, backpressure, allocation and energy observations; separate from any implementation optimization above.
- [ ] Device-only smoke, accessibility, minimum-OS and signed-consumer checks referenced by other items are likewise deferred to the maintainer.

## Review notes

2026-10-23: Removed superseded Apple/Google providers, live-camera gate work,
TypeGPU/readback, Metal-only and early shared-output spikes from the active list.
Consolidated duplicate compatibility, rendering, lifecycle and benchmark tasks;
updated marker clustering, world shaders and native CI to the current working tree.
Historical implementation/build counts remain in [verification](docs/verification.md)
and Git history. This review does not claim new native builds or runtime results.

2026-10-24: Applied the maintainer's completion policy: implemented features can be
complete after appropriate automated/build/simulator checks. Physical-device tests
and resulting tweaks are maintainer-owned follow-up, not feature blockers. No
hardware measurements or publication approval are implied.
