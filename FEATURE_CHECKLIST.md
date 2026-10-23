# Project checklist

Last reviewed: **2026-10-23**, against the current working tree.

Package-owned MapLibre Native on iOS/Android, React Native New Architecture only.
The public API is component-based: `MapView`, `Marker`, `Polyline`, `Polygon`,
`Circle`, and experimental `ShaderLayer` through `/shaders`. Sources and style
layers are internal infrastructure; marker clustering replaces the former public
source-oriented clustering API. See the [approved component direction](docs/plans/2026-10-21-marker-clustering.md)
and [current exports](packages/maps/src/index.ts).

Layers, native clustering, native gestures and portable custom GPU shaders remain
required v1 work. Removing a retired API does not close its underlying quality gate.
The exact remaining layer surface needs reconciliation with the component direction.

Use this file for remaining work. Keep detailed contracts in `docs/` and results in
[verification](docs/verification.md). Checked items describe bounded implementations,
not production acceptance. Unchecked items state the remaining requirement; simulator
smoke checks do not establish physical-device performance. Existing IDs are retained
where useful (combined IDs share one task); retired IDs must not be reused.

## Implemented foundation

- [x] **ARCH-01–06, MAP-13** — Workspace, package-owned Fabric hosts, pinned baseline dependencies, declarations, Codegen, autolinking and packed-consumer checks.
- [x] **ARCH-07** — Revision-scoped native capability reports; layers and shaders remain unvalidated. [Capabilities](docs/capabilities.md).
- [x] **CAM-01–02** — Validated mount-only initial camera and imperative `animateCamera`, with rejection before readiness.
- [x] **SRC-03** — Internal source revisions reject stale replacements and preserve accepted scenes. [Contract](docs/source-revisions.md).
- [x] **SHAPE-01** — Polygon, Polyline and geographic Circle with stroke styling and typed presses. [Shapes](docs/shapes.md).
- [x] **GEST-04, PICK-01** — Confirmed map tap/long-press and structured native feature routing; component callbacks remain public. [Map presses](docs/map-presses.md), [picking internals](docs/feature-picking.md).
- [x] **TEST-01–02, TEST-04** — Contract/native-helper tests, production bundle and package checks, and development/build commands exist. These do not replace native runtime acceptance.

## Map lifetime, camera and gestures

- [ ] **MAP-07–09, MAP-12** — Verify mount/teardown, resize/rotation, background/resume, navigation, multiple maps, interrupted initialization and style/tile/network failure recovery. Include repeated cycles with memory/resource counts.
- [ ] **MAP-10** — Define supported MapLibre settings and controls, including padding, zoom limits and gesture toggles; reconcile old provider-specific settings with the current engine.
- [ ] **MAP-11** — Native Release builds and physical-device smoke checks on both platforms.
- [ ] **CAM-04, CAM-06, CAM-08** — Complete idle/origin, animation completion, exact no-op, interruption, SDK-control and disposal matrices. Simulator app/gesture/compass cases are recorded in [camera origins](docs/camera-origins.md).
- [ ] **CAM-07, CAM-11** — Define controlled camera ownership/precedence and test rapid commands, feedback loops and event volume if that API is added.
- [ ] **CAM-09–10** — Complete geographic, high-pitch, padding, resize, animation and lifecycle coverage for projection, visible bounds and fit methods. Both simulators have bounded round-trip/dateline/fit evidence. [Geometry contract](docs/map-geometry.md).
- [ ] **GEST-01–03, GEST-06** — Complete native pan/zoom/rotate/tilt provenance, throttling, simultaneous recognition and cancellation under detach/navigation/stress. Background cancellation and subscription cycling have simulator evidence. [Gestures](docs/gestures.md).
- [ ] **GEST-05, A11Y-05** — Marker touch ownership and hit order under multi-touch, nested scroll, bottom sheets, navigation, multiple maps and GPU touch-through. [Marker gestures](docs/marker-gestures.md).

## Markers, shapes and internal rendering

- [ ] **COMPAT-03–04, COMPAT-10–11** — Verify React marker child updates, overlap/zIndex, selection, accessibility, lifecycle and Android texture/coordinate alignment. Decide dedicated image, dragging and callout APIs. [Marker sync evidence](docs/marker-coordinate-sync.md).
- [ ] **SHAPE-02, LAYER-02, LAYER-04–05, LAYER-10–11** — Complete holes, geometry/style replacement, visibility, insertion/draw/hit order, antimeridian and cross-platform semantic fixtures for internal circle/line/fill rendering and public shapes.
- [ ] **SHAPE-03** — Decide remaining shape compatibility: CSS colors, geodesic geometry, gradient strokes and dash phase.
- [ ] **LAYER-03, LAYER-06–09, SRC-02** — Reconcile required symbol/icon, raster/tile, heatmap, expression/filter and zoom-range work with the component-only API before implementation. Existing literal styles and scene rebuilds are only a subset; do not restore the retired public `Layer` API by assumption.
- [ ] **SRC-04, SRC-07, ARCH-09** — Measure parsing/rebuild cost; design incremental updates, off-UI-thread work, cancellation and bounded queues where needed. Android currently uses synchronous source updates for alignment.
- [ ] **SRC-05–06** — Broader malformed native input and geographic fixtures (wrapping, poles, holes, multi-geometries). Existing aggregate position and 4 MiB scene bounds remain in force. [Scene budgets](docs/scene-budgets.md).
- [ ] **PICK-02–03, PICK-05** — Complete visibility/overlap and marker/shape/cluster routing coverage, hit-test cost and accessible alternatives; decide public hit-radius/multiple-hit requirements.

## Native marker clustering

Current implementation compiles opt-in `Marker.cluster` children into a private
MapLibre index, renders default/custom React cluster children, and exposes lazy
membership and expansion through cluster component props. Source query APIs and
their old fixtures describe internal/historical behavior, not the current public API.
[Plan](docs/plans/2026-10-21-marker-clustering.md), [implementation](packages/maps/src/markerClustering.ts),
[regressions](tests/marker-clustering.test.mjs).

- [ ] **CLUSTER-01–05** — Verify the component flow end to end on both hosts: custom/default cluster rendering, count/coordinate, lazy metadata membership, expansion, opt-out markers, updates and rejected/stale layouts or queries after style reload/remount. Prior source-index smoke evidence does not establish component acceptance.
- [ ] **CLUSTER-06** — Bound native/React visible output, index memory and background/cancellation behavior.
- [ ] **CLUSTER-07** — Port membership audits to the component API and add overlap, zoom-boundary and antimeridian fixtures. Prior internal query fixtures passed complete 1k/10k coincident-point audits; spatial parity remains open.
- [ ] **CLUSTER-08, SRC-08** — Deterministic release-device 1k/10k benchmarks, update latency and cross-platform semantics. Evaluate 100k separately: the current clustered-marker/source limit is 10k.

## Portable custom GPU shaders

The current path is [ShaderLayer](docs/shader-layer.md): one WGSL program set on
both platforms, optional compute/storage, packed uniforms, world Mercator tiles,
a dedicated Worklets runtime and shared native atlas leases without pixel readback.
Recorded simulator publications during main-JS stalls demonstrate scheduling
independence. Android software-adapter diagnostics do not prove hardware acceptance.

- [ ] **GPU-05–08, GPU-18** — Quantify projection/alignment during pan, zoom, rotation, high pitch, padding, resize and animation; cover high zoom, wrapping, horizon gaps and atlas resolution transitions. Planar Mercator/polar limits must remain explicit.
- [ ] **GPU-09** — Stabilize the experimental WGSL/input/resource contract. Decide schema-typed authoring and streamed texture requirements separately from current packed uniforms/storage.
- [ ] **GPU-10–11** — Measure physical-device scheduling, frame age, backpressure, allocation and energy costs; evaluate native-fence handoff beyond current GPU-queue completion waits.
- [ ] **GPU-12** — Stress initialization interruption, failed shader edits, pause/background/resume, style replacement, multiple maps/layers and idempotent disposal. Automatic device-loss recovery remains unimplemented.
- [ ] **GPU-13–14** — Validate capability/error degradation and composition limits, including label placement, controls/attribution and native marker ordering. Capability reports currently mark shaders unvalidated.
- [ ] **GPU-15** — Physical-device Release frame time, alignment, memory, dependency-size and build-cost budgets.
- [ ] **PICK-04** — Decide GPU picking and ordering relative to ordinary content; supply interaction alternatives for visual-only effects.

## Reliability, performance and verification

- [ ] **ARCH-08** — Consistent recoverable/fatal errors across map, source, command and GPU failures.
- [ ] **PERF-02–05, PERF-09** — Choose physical reference devices and numeric budgets; compare equivalent native-only/pinned RN Maps scenarios. Measure frame-time percentiles, dropped frames, UI responsiveness and busy-JS behavior with repeatable artifacts.
- [ ] **PERF-06–07, PERF-10** — At least 100 lifecycle cycles, memory drift/resource bounds, large-content update/cancellation cost, poor-network/offline behavior, memory pressure and GPU failure resilience.
- [ ] **PERF-08** — Core versus GPU npm/app binary sizes and clean/incremental build cost.
- [ ] **TEST-03, TEST-10** — Verify current remote CI results. Both [quality/bundle](.github/workflows/check.yml) and [native Android/iOS build workflows](.github/workflows/native.yml) are defined; workflow presence alone is not a successful run.
- [ ] **TEST-05–09, TEST-11** — Consolidate current component scenarios and automate selection/collection with readiness/timeouts. Record commit, platform/device/OS, SDK/RN, build mode, seed and pass/fail/skip; include semantic checks, controlled visual baselines, alignment and trace capture. Unavailable devices must not count as passes.
- [ ] **TEST-12** — Verify Release consumers omit development diagnostic interfaces and sensitive data by default.
- [ ] **A11Y-01–03, A11Y-06** — VoiceOver/TalkBack acceptance for markers, clusters and shapes, accessible navigation/selection, reduced motion and shader pause alternatives. iOS child-label/frame fixes have bounded simulator evidence only.

## Compatibility and distribution

- [ ] **COMPAT-01–02, COMPAT-05–06, COMPAT-08–09** — Pin RN Maps and document supported/partial/unsupported APIs with equivalent fixtures and migration examples. Current familiar component names do not promise full parity; include camera/bounds/snapshot/helper gaps.
- [ ] **COMPAT-07, A11Y-04** — Define user-location/tracking, permission ownership, denial and privacy behavior.
- [ ] **ARCH-11, REL-07** — Freeze supported OS/RN/SDK ranges from evidence; document upgrades, migration and known limits.
- [ ] **REL-01, REL-08** — Resolve package ownership, repository metadata, license, SDK attribution and dependency/distribution requirements. Packages are currently private and UNLICENSED.
- [ ] **REL-02, REL-05** — Packed bare consumers build Debug/Release on iOS/Android; verify exports, autolinking, declarations and optional GPU peers outside the workspace.
- [ ] **REL-04** — Expo config plugin and custom development/production builds; Expo Go is outside the native target.
- [ ] **REL-06** — Reconcile public docs/examples with component exports and finish installation/API/capability references. Some source/layer docs still describe retired public APIs.
- [ ] **REL-09–10** — Changelog/versioning, prerelease/provenance/credential policy, bug/security reporting and maintenance policy.
- [ ] **REL-11** — Validate npm prerelease and obtain explicit publishing approval.

## Future discovery (outside accepted v1 scope)

- **DISC-01–04** — Mapbox gap inventory; vector tiles, feature state/transitions, richer data-driven styling and advanced text/sprites/fonts beyond the agreed initial scope.
- **DISC-05, DISC-07** — Terrain, extrusions, globe/3D and offline datasets/downloads, with technical and licensing constraints.

Additional/custom sources need explicit contracts. Legacy React Native architecture
and alternative native module architectures remain outside the agreed target.
TurboModules should be added only when a concrete non-view operation needs one
(former ARCH-10), rather than as a standalone feature.

## Release gates

All remain open. Implementation and simulator evidence alone do not close them.

- [ ] **GATE-01** — Measured projection, composition, threading and lifetime paths for MapLibre, required layers and portable shaders on both platforms.
- [ ] **GATE-02** — Approved camera, component/rendering, cluster, capability, error and compatibility contracts.
- [ ] **GATE-03** — Required v1 functionality with acceptance coverage on both platforms.
- [ ] **GATE-04** — Physical-device Release performance, stability, accessibility and size budgets pass.
- [ ] **GATE-05** — Clean bare/Expo consumers, public documentation, SDK integration, licenses and package ownership resolved.
- [ ] **GATE-06** — Remaining limitations accepted and publishing explicitly authorized.

## Review notes

2026-10-23: Removed superseded Apple/Google providers, live-camera gate work,
TypeGPU/readback, Metal-only and early shared-output spikes from the active list.
Consolidated duplicate compatibility, rendering, lifecycle and benchmark tasks;
updated marker clustering, world shaders and native CI to the current working tree.
Historical implementation/build counts remain in [verification](docs/verification.md)
and Git history. This review does not claim new native builds or runtime results.
