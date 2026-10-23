# Package feature checklist

Last reviewed: **2026-10-21**. Current phase: **package-owned MapLibre implementation and verification**.
This is the living inventory for the whole package, through npm release and maintenance.
Stability and measured performance take priority. **Layers, native clustering, native
gesture recognition and TypeGPU shaders are required v1 work.** A prototype does
not satisfy the corresponding production feature or release gate.

Current scope: [package-owned MapLibre migration](docs/plans/2026-10-20-package-owned-maplibre.md)
and [current API](README.md). MapLibre Native on iOS and Android replaces the removed
Apple/Google providers and React Native MapLibre wrapper. The [original design](docs/plans/2026-10-19-native-maps-design.md)
and earlier prototype results are historical; they do not verify the migrated implementation.
Stable IDs below retain superseded work explicitly rather than implying it still ships.
Detailed contracts: [contracts](docs/contracts.md). Evidence: [verification log](docs/verification.md).
This inventory covers the agreed direction and known gaps; it is not a claim of
exhaustive Mapbox or react-native-maps parity. The pinned API inventories below must
identify further differences as we investigate them.

## How to keep this file current

- Update relevant items with every feature, fix, investigation or verification change.
- Keep IDs stable. Add new items with new IDs; do not renumber existing items.
- Use `[x]` only for a completed, explicitly scoped item with evidence. Keep prototypes,
  partial implementations and missing verification unchecked.
- Statuses: **Done**, **In progress**, **Prototype**, **Unverified**, **Planned**,
  **Blocked**, **Discovery**, **Deferred**, **Superseded**. A blocked item needs its blocker and next step.
- Record provider/platform limits and link the implementation, scenario, test or result.
  Passing one platform must not imply passing the other.
- Split large items into smaller acceptance criteria as their contracts become clear.
  New findings may reopen completed items; explain why in the change history.
- Add discoveries to the backlog, then explicitly decide v1/future scope. Do not quietly
  defer a required v1 feature or mark a reduced prototype as the original feature.
- Local artifacts are ignored and may not exist on another checkout. Keep the commands,
  scenario definitions and written conclusions versioned. Mark missing evidence explicitly.
- Review release gates before each prerelease. Avoid overall percentage claims: item
  sizes differ and this inventory will grow.

## 1. Architecture and package foundation

- [x] **ARCH-01 · Done** — npm workspace with core and native example. The obsolete TypeGPU raster companion was removed.
- [x] **ARCH-02 · Done** — Fabric map host and native Codegen boundary on iOS and Android.
- [x] **ARCH-03 · Done** — New Architecture only; baseline RN/React and native SDK versions locked.
- [x] **ARCH-04 · Done** — Core has no runtime npm dependencies; GPU runtime dependencies remain companion peers.
- [x] **ARCH-05 · Done** — Public TypeScript declarations and positive/negative API type tests.
- [x] **ARCH-06 · Done** — Packed file/export checks, CLI autolinking discovery and declaration-consumer installation.
- [x] **ARCH-07 · Done (bounded current host)** — Native readiness reports identify MapLibre/platform and expose layer, detailed-gesture and integrated shader evidence states through getCapabilities/onCapabilitiesChange. Reports are bounded/validated/frozen, invalidated on style/fatal/disposal transitions and tied to request revisions. Existing layers remain unvalidated; absent integrations are unsupported even with the optional TypeGPU helper installed. [Contract and limits](docs/capabilities.md), [regressions](tests/capabilities.test.mjs).
- [ ] **ARCH-08 · Prototype** — Map error classification and fatal-readiness reset exist; consistent recoverable/fatal taxonomy across sources, layers, commands and GPU resources remains open.
- [ ] **ARCH-09 · Planned** — Native generation/revision guards, cancellation, bounded queues and backpressure for asynchronous feature work.
- [ ] **ARCH-10 · Planned** — TurboModule interfaces for operations that need a non-view module; current operations use Fabric view commands.
- [ ] **ARCH-11 · Planned** — Freeze supported OS/RN/SDK ranges from evidence and document upgrade policy.

Evidence: [package manifests](packages/), [native specs](packages/maps/src/specs/),
[package verification](scripts/check-package.mjs), [compatibility](docs/compatibility.md).

## 2. Native engine and map lifetime

- [ ] **MAP-01 · Superseded** — Google Maps Android experiment removed; current Android host uses MapLibre Native.
- [ ] **MAP-02 · Superseded** — Google Maps iOS experiment removed; current iOS host uses MapLibre Native.
- [ ] **MAP-03 · Superseded** — Apple MapKit experiment removed; current iOS host uses MapLibre Native.
- [ ] **MAP-04 · Superseded** — Provider selection removed; MapView requires styleURL and supports iOS/Android only.
- [ ] **MAP-05 · Superseded** — Google credential setup removed; MapLibre style/tile hosting requirements remain application-owned.
- [ ] **MAP-06 · Superseded** — Optional Google iOS linkage removed; the package owns MapLibre SPM integration.
- [ ] **MAP-07 · Unverified** — MapLibre mount/style readiness, lifecycle forwarding and teardown exist in native hosts; complete migrated runtime lifecycle coverage remains open.
- [ ] **MAP-08 · Unverified** — Full MapLibre lifecycle matrix on both platforms: resize, rotation, background/resume, screen navigation and multiple maps.
- [ ] **MAP-09 · Planned** — Initialization interruption, missing/invalid credentials, tile/network failure and recovery scenarios with timeouts.
- [ ] **MAP-10 · Planned** — Consistent supported settings: map type/style, padding, zoom limits, gestures, controls, buildings, traffic and points of interest.
- [ ] **MAP-11 · Unverified** — Native release builds and physical-device smoke checks on both platforms.
- [ ] **MAP-12 · Planned** — Repeated mount/disposal and background/resume stress with native resource counts and memory evidence.

Current implementation: [Android host](packages/maps/android/src/main/java/com/enhancedmaps/EnhancedMapLibreView.kt), [iOS host](packages/maps/ios/EMMapLibreView.mm). Historical and shape-specific results: [verification](docs/verification.md),
[development setup](docs/development.md).

- [x] **MAP-13 · Done (implementation)** — Package-owned Fabric MapLibre hosts on iOS/Android, direct SDK dependencies and styleURL-driven scenes; wrapper/patch installers removed. [Migration plan](docs/plans/2026-10-20-package-owned-maplibre.md), [native boundary](packages/maps/src/specs/MapLibreViewNativeComponent.ts). Runtime and release gates remain separate.

## 3. Camera and event behavior

- [x] **CAM-01 · Done** — Mount-only initial camera with runtime coordinate/camera validation.
- [x] **CAM-02 · Done** — Imperative `animateCamera`; explicit command rejection before readiness.
- [ ] **CAM-03 · Superseded** — Bounded live camera subscription API removed. The current host exposes camera idle only; standalone gate helpers/tests do not establish live delivery in MapLibre.
- [ ] **CAM-04 · Prototype** — MapLibre idle callback implemented on both platforms with SDK-derived origin (CAM-06). Full idle/no-op/disposal semantics need runtime verification.
- [ ] **CAM-05 · Unverified** — Standalone Java/C++ camera gate tests remain, but the MapLibre hosts do not use these gates; earlier three-provider gesture checks are historical.
- [ ] **CAM-06 · Prototype** — Native operation evidence supplements ambiguous SDK reasons. Android initial/animated/immediate application movement, exact no-op, gesture interruption (also with JS gesture events disabled) and compass interruption passed. iOS public compass-operation tracking and synchronous application-call ownership fix both directions of compass/app interruption; exact repeat and gesture interruption with JS events disabled passed. Compass taps no longer produce iOS background presses; Android controls lay out on fresh mounts. Full timing/control/lifecycle matrices remain open. [Contract](docs/camera-origins.md).
- [ ] **CAM-07 · Planned** — Controlled camera/region ownership and precedence versus gestures, SDK controls and imperative commands.
- [ ] **CAM-08 · Planned** — Animation completion, cancellation, interruption, no-op movement and post-disposal semantics.
- [ ] **CAM-09 · Prototype** — Async pointForCoordinate, coordinateForPoint, getVisibleBounds, fitCoordinates and fitElements use bounded native requests with timeout, style/unmount cancellation and result validation. Both simulators passed off-center round trips, padded coordinate fitting, pitched dateline fitting and animated return, accepted-source/marker fitting, empty-element rejection, fitting after style reload/remount, and 160-point resize/expansion. Heading 45/pitch 35 is preserved. A bounded tightening search fixes excessively wide SDK seeds in short pitched viewports (local fixture now near zoom 9.4). Full geographic, lifecycle, interruption and physical-device matrices remain open. [Contract](docs/map-geometry.md).
- [ ] **CAM-10 · Unverified** — MapLibre zoom, padding, heading, pitch and animation timing semantics on both platforms.
- [ ] **CAM-11 · Planned** — Feedback-loop and event-volume regressions during controlled updates, rapid commands and concurrent map movement.

Evidence: [camera contract](docs/contracts.md), [native gate tests](tests/native/),
[current MapLibre boundary](packages/maps/src/specs/MapLibreViewNativeComponent.ts).

## 4. Native gesture recognition

- [ ] **GEST-01 · Prototype** — Public SDK/recognizer observers implement pan, pinch/continuous zoom, rotate and tilt. All four plus one-finger quick zoom passed running iOS/Android simulator smoke tests; interruptions and broader device coverage remain open. [Contract](docs/gestures.md).
- [ ] **GEST-02 · Prototype** — Typed begin/update/end/cancel, independent simultaneous-kind IDs and subscription revisions are implemented with native gate regressions. Both simulators passed Home/background cancellation for held pan/zoom/rotate/tilt, exactly one terminal per begun ID, simultaneous-kind cancellation and a fresh pan after resume. Subscriber removal/restoration during a held pan silences existing recognition; a subsequent new pan delivers normally on both hosts. Detach/disposal, navigation and container matrices remain open. [Evidence](docs/gestures.md).
- [ ] **GEST-03 · Prototype** — Camera origin is derived from native SDK reasons (CAM-06), without coordinate-delta inference. Detailed gesture-kind/lifecycle provenance remains open.
- [x] **GEST-04 · Done (bounded API)** — MapView.onPress exposes confirmed background taps and onLongPress exposes native long holds with geographic/logical-point location. Feature taps remain source/shape callbacks; double-tap/quick zoom do not select. Both simulators verified feature/background isolation, subscriber removal and child marker tap/hold isolation. 61 tests, native builds and bundles pass. Wider container coverage remains GEST-05. [Contract](docs/map-presses.md).
- [ ] **GEST-05 · Prototype** — Marker children reserve native touches from their start using pointer-event-aware hit targets; Android stream ownership survives late responder claims/removal until UP/CANCEL and resets on detach/disposal, iOS SDK/picker recognizers decline marker-target touches. Native gate tests and SDK builds pass; device, multi-touch, nested-scroll, bottom-sheet, navigation and GPU touch-through coverage remain open. [Contract and limits](docs/marker-gestures.md).
- [ ] **GEST-06 · Prototype** — Four bounded native slots, per-kind throttling, uncoalesced phases and terminal/cancellation regressions are implemented without private SDK view inspection. Both simulators passed 250 ms throttling, with Android terminal delivery observed 120 ms after its last update. Both simulators passed background cancellation (including simultaneous kinds), latest focal-point retention and held-pan subscription cycling without replay. Broader interruption/stress coverage remains open.

## 5. react-native-maps compatibility

These items are compatibility workstreams, not a promise to implement every upstream API in v1.

- [ ] **COMPAT-01 · Planned** — Pin an upstream release and enumerate every component, prop, method and event with supported/partial/unsupported status.
- [ ] **COMPAT-02 · Prototype** — Familiar `MapView` camera/readiness interface; full behavioral compatibility is not established.
- [ ] **COMPAT-03 · Prototype** — Public Marker accepts mounted React Native children, stable IDs, coordinate, anchor, offset and zIndex. Dedicated image/drag APIs and full update/lifetime compatibility remain open.
- [ ] **COMPAT-04 · Planned** — Callouts and marker selection semantics, including accessibility and overlap behavior.
- [ ] **COMPAT-05 · Prototype** — Polyline, Polygon with holes and geographic Circle are public; typed press callbacks and native stroke styling implemented. Tile/image overlay compatibility remains open. See [shapes](docs/shapes.md).
- [ ] **COMPAT-06 · Planned** — Region/camera methods, fit methods, map boundaries, snapshots and coordinate helper compatibility.
- [ ] **COMPAT-07 · Planned** — User-location display/tracking and permission-denied behavior; no unnecessary permission requests.
- [ ] **COMPAT-08 · Planned** — Migration examples, unsupported API errors and provider-specific behavior documentation.
- [ ] **COMPAT-09 · Planned** — Equivalent fixture scenarios against pinned react-native-maps before compatibility claims.

- [ ] **COMPAT-10 · Prototype** — Marker zIndex ordering implemented on both native platforms; Android dirty bitmap captures retain native children for input, iOS uses annotation views. Child/map gesture arbitration, overlapping hit order and full migrated lifecycle/performance coverage remain open. [Marker API](packages/maps/src/Marker.tsx), [Android texture implementation](packages/maps/android/src/main/java/com/enhancedmaps/EMMarkerTexture.kt).
- [ ] **COMPAT-11 · Unverified** — Android marker coordinate commits reuse textures and use synchronous source updates. Recorded smoke evidence found zero separated frames in 43 decoded frames/two visible transitions; this does not establish throughput or iOS parity. [Scope and evidence](docs/marker-coordinate-sync.md).

## 6. Geographic sources and data updates

- [ ] **SRC-01 · Prototype** — Public GeoJSONSource validates bounded immutable GeoJSON and feeds native circle/line/fill layers through compileScene. Both MapLibre hosts consume inline sources; broader source support remains open.
- [ ] **SRC-02 · Planned** — Raster tile source contract, tile coordinates, request cancellation and bounded caching.
- [x] **SRC-03 · Done (bounded contract)** — Stable source/feature IDs and immutable full replacement; explicit optional revisions cross scene transport and are enforced by both native hosts before mutation. Stale/equal-changed/unversioned downgrades reject the scene recoverably; accepted state survives style reload and resets on removal/disposal. Unversioned sources/shapes retain replacement behavior. See [contract and limits](docs/source-revisions.md), [regressions](tests/source-revisions.test.mjs).
- [ ] **SRC-04 · Planned** — Incremental insert/update/delete without serializing full sources for every update.
- [ ] **SRC-05 · Planned** — Coordinate order, antimeridian/world wrapping, poles, holes and multi-geometry fixtures.
- [ ] **SRC-06 · Prototype** — Existing malformed GeoJSON checks now include aggregate 50k declared/100k layer-weighted position limits and a 4 MiB UTF-8 scene budget; both hosts independently reject oversized payloads before parsing/mutation. Explicit revision/disposal guards are covered under SRC-03. Broader malformed native payload handling and future asynchronous-work cancellation remain open. [Contract](docs/scene-budgets.md), [regressions](tests/scene-budgets.test.mjs).
- [ ] **SRC-07 · Planned** — Move heavy parsing/indexing off the UI thread where appropriate. Android inline sources use synchronous updates for marker/scene alignment; update costs need measurement.
- [ ] **SRC-08 · Planned** — Deterministic 1k/10k/100k datasets and source-update latency measurements.

## 7. Layers — required v1 scope

- [ ] **LAYER-01 · Prototype** — Public GeoJSONSource/Layer coexist with Polyline/Polygon/Circle. Package-owned MapLibre adapters implement native style sources/layers; shared CPU renderer removed.
- [ ] **LAYER-02 · Prototype** — Native circle point layer with color, radius and opacity implemented on both platforms; geographic Circle is a separate polygon-based component. Runtime edge/performance coverage remains open.
- [ ] **LAYER-03 · Planned** — Symbol/icon layer; document collision, text/font and image-loading limits.
- [ ] **LAYER-04 · Prototype** — Native MapLibre line layers with literal color, opacity and width; shape components add caps, joins, miter limits and dashes. Geographic edge fixtures remain open.
- [ ] **LAYER-05 · Prototype** — Native MapLibre fill layers and polygon holes implemented; complete geographic and runtime fixture coverage remains open.
- [ ] **LAYER-06 · Planned** — Production raster layer and tile integration; experimental single-image overlay is not completion.
- [ ] **LAYER-07 · Planned** — Heatmap native provider implementation remains planned; shared CPU reference renderer was removed.
- [ ] **LAYER-08 · Planned** — Bounded typed style expressions: literals, property lookup, zoom, match/step/interpolation as approved.
- [ ] **LAYER-09 · Prototype** — Visibility and literal style replacement implemented. Filters, zoom ranges and incremental native style mutation remain open; hosts rebuild scene resources.
- [ ] **LAYER-10 · Prototype** — Layer beforeId supports insertion relative to existing MapLibre style layers; shapes sort by zIndex/declaration order and markers have separate native ordering. Complete cross-content draw/hit-order coverage remains open.
- [ ] **LAYER-11 · Unverified** — Identical semantic fixtures and capability evidence on MapLibre iOS and Android; historical three-provider results do not apply.
- [ ] **LAYER-12 · Superseded** — Apple/Google single-image overlay removed. The unused ExperimentalRasterOverlay types/helpers and TypeGPU readback companion are also removed.

Current source/layer API: [scene compiler](packages/maps/src/maplibreContent.tsx),
[MapLibre scenarios](docs/maplibre-prototype.md), [fixture tests](tests/maplibre-fixtures.test.mjs).
The [earlier layer contract](docs/layers.md) and [scenario](docs/layer-scenario.md) are historical.
Expressions, richer picking, source patches, additional layer kinds and release-device budgets remain open.

Historical LAYER-12 evidence: [shader raster scenario](docs/shader-raster-scenario.md); removed native integration is not current support.

## 8. Native clustering — required v1 scope

- [ ] **CLUSTER-01 · Prototype** — Chose installed native MapLibre clustering over a duplicate native Supercluster dependency or custom grid. No new linked library/runtime dependency; native binary delta and index resource costs remain unmeasured. [Decision and contract](docs/clustering.md).
- [ ] **CLUSTER-02 · Prototype** — Bounded common radius/maxZoom/minPoints options use SDK tile units without density multiplication. Both simulators match the three-point/isolated fixture at zoom 13 and original points at zoom 16. Full zoom-boundary and deterministic membership matrices remain open.
- [ ] **CLUSTER-03 · Prototype** — Generated cluster IDs and point counts reach structured/legacy hits on both hosts. Reserved cluster: IDs and metadata properties prevent input ambiguity. Identity is scoped to an index lifetime; stable-revision identity and aggregation remain open.
- [ ] **CLUSTER-04 · Prototype** — Separate cluster/point circle styling, picking, bounded children/leaves pagination and parent/child expansion zoom passed on both simulators. Opaque handles reject copies and obsolete indexes. Count expressions and symbol styling remain open. [Inspection contract](docs/clustering.md).
- [ ] **CLUSTER-05 · Prototype** — Settings participate in source revision identity. Both simulators preserve handles after rejected updates and reject held handles after accepted scene changes, style reload and remount. Generated hits bind to accepted native indexes even after a rejected clustering-disable candidate. Incremental/background update cancellation remains open.
- [ ] **CLUSTER-06 · Planned** — Background processing, bounded visible output and memory limits.
- [ ] **CLUSTER-07 · Prototype** — Both hosts pass exact duplicate/nearby/isolated membership and child inspection, plus complete 1000/10000 coincident-point audits across 10/100 pages with no missing/duplicate IDs, frozen results and empty terminal pages. Spatial overlap, zoom-boundary and antimeridian matrices remain open.
- [ ] **CLUSTER-08 · Planned** — Release-device benchmarks for 1k/10k/100k points and cross-provider semantic parity.

## 9. TypeGPU and custom shaders — required v1 scope

- [x] **GPU-01 · Superseded** — Removed the obsolete TypeGPU raster companion and dependencies. react-native-webgpu is the current runtime direction; optional typed authoring remains a future adapter.
- [ ] **GPU-02 · Superseded** — Removed the triangle/readback experiment; shared-output MapLibre integration is tracked in GPU-17.
- [ ] **GPU-03 · Superseded** — Removed the old typed triangle uniform API. The WebGPU prototype accepts JS uniforms; public typed resource contracts remain GPU-09.
- [ ] **GPU-04 · Superseded** — Removed obsolete raster tests and TypeGPU-specific Babel transforms with their implementation. Current shared-output checks are tracked in GPU-17.
- [ ] **GPU-05 · Planned** — Live GPU renderer integration; the sibling Canvas particle prototype was dropped in favor of designing the general layer API first.
- [ ] **GPU-06 · Planned** — Provider rendering/projection contract; the prototype JS projection feed was removed and is not the general layer abstraction.
- [ ] **GPU-07 · Unverified** — Quantified alignment under pan, zoom, rotation, tilt, resize, padding and camera animations on MapLibre iOS/Android, after restoring a GPU integration path.
- [ ] **GPU-08 · Planned** — Native reference anchors, high-zoom precision, local-origin strategy and wrapping/polar behavior.
- [ ] **GPU-09 · Planned** — Reusable public custom-shader layer API with typed buffers, uniforms, viewport/projection state and ownership.
- [ ] **GPU-10 · Planned** — Scheduling decision backed by JS-contention measurements; prove independence if it is advertised.
- [ ] **GPU-11 · Planned** — Frame scheduling/backpressure and bounded allocations; no per-frame GPU readback in live rendering.
- [ ] **GPU-12 · Unverified** — Initialization interruption, shader failure, device loss/recovery, pause/resume and idempotent disposal under stress.
- [ ] **GPU-13 · Planned** — Runtime GPU capability reporting and graceful degradation that preserves the ordinary map.
- [ ] **GPU-14 · Planned** — Explicit composition limits, attribution/control protection and interactions with ordinary layers.
- [ ] **GPU-15 · Planned** — Physical-device release frame times, alignment, memory, GPU dependency size and build-cost budgets.

- [ ] **GPU-16 · Prototype** — iOS Debug custom Metal style layer accepts example-owned shader source and uniforms from JS, with native time and below/above-symbol placement. Waves/radar/checkerboard programs and the native host build compile; 71-test package checks pass. Mac Metal pipeline compilation is separate from simulator/device runtime evidence. No Android backend, TypeGPU integration, stable shader API or performance claim. [Scope and evidence](docs/custom-gpu-prototype.md).

Historical static display evidence: [shader scenario](docs/shader-raster-scenario.md), [verification](docs/verification.md). Current helper code: [TypeGPU exports](packages/typegpu/src/index.ts).
Live GPU integration remains required v1 scope. Its layer contract and rendering
path need separate design and measured verification.
**Portability requirement (2026-10-21):** programmers author each shader once and
use the same JS API on iOS/Android. Hand-maintained Metal/GLES effect copies do
not satisfy GPU-09. Generated backend programs are acceptable; the current
Metal-only spike is not cross-platform completion. See [portability investigation](docs/custom-gpu-prototype.md).

## 10. Picking and feature interaction

- [x] **PICK-01 · Done (bounded API)** — GeoJSONSource.onFeaturePress exposes native source/layer/feature IDs, SDK properties, geographic tap coordinate and map-relative logical point. Existing onPress(featureId) and shape callbacks remain. Both simulators verified Unicode/nested properties and accepted native data after stale-source rejection/style reload; 60 tests, native builds and bundles pass. [Contract](docs/feature-picking.md).
- [ ] **PICK-02 · Prototype** — Native queries select the topmost interactive rendered layer and skip noninteractive layers. Public hit radius, overlapping result lists and full visibility semantics remain open.
- [ ] **PICK-03 · Prototype** — Circle/line/fill and shape press routing implemented on both platforms. Complete runtime parity, marker arbitration and cluster interaction remain open.
- [ ] **PICK-04 · Planned** — Explicit GPU picking mechanism and ordering relative to ordinary layers.
- [ ] **PICK-05 · Planned** — Native hit-test performance and accessibility alternatives for visual-only features.

## 11. Stability, performance and size

- [ ] **PERF-01 · Superseded** — Earlier bounded live-camera measurements describe removed providers. Current public API emits idle only; no migrated event-volume or release-FPS claim.
- [ ] **PERF-02 · Planned** — Choose physical reference devices and numeric acceptance thresholds before evaluating performance.
- [ ] **PERF-03 · Planned** — Native-only and pinned react-native-maps baselines with equivalent scenarios.
- [ ] **PERF-04 · Planned** — Release p50/p95/p99 frame time, dropped frames and UI responsiveness during gestures.
- [ ] **PERF-05 · Planned** — Busy-JS workload and native/GPU camera synchronization measurements.
- [ ] **PERF-06 · Planned** — At least 100 lifecycle cycles, memory drift, leak/resource counters and pending-job bounds.
- [ ] **PERF-07 · Planned** — Large-source/clustering/layer update latency and cancellation benchmarks.
- [ ] **PERF-08 · Planned** — npm and application binary sizes for core-only versus GPU installations, plus clean/incremental build cost.
- [ ] **PERF-09 · Planned** — Performance regression budgets and repeatable benchmark artifact collection.
- [ ] **PERF-10 · Planned** — Offline/poor-network behavior, memory pressure and GPU failure resilience.

## 12. Verification and tools for humans/AI

- [x] **TEST-01 · Done** — Workspace type/contract checks, standalone native helper tests and Fabric Codegen exist. Helper tests are distinct from MapLibre SDK/runtime integration coverage.
- [x] **TEST-02 · Done** — Production Metro bundles for both platforms and packed declaration-consumer checks.
- [ ] **TEST-03 · Unverified** — GitHub Actions defines check/bundle jobs and artifact retention. Earlier remote success predates the current working-tree migration; no current remote run verified.
- [x] **TEST-04 · Done** — Root commands for examples, package/native builds, checks, doctor, cache reset and bounded cleanup; runner tests/dry runs passed.
- [ ] **TEST-05 · Prototype** — Example native-layer and custom-marker controls cover fixtures, changes, picking and remounts. Historical camera/shader diagnostics are not current migrated runtime evidence.
- [ ] **TEST-06 · Planned** — Versioned scenario result schema with commit, provider, device/OS, SDK/RN versions, build mode, seed and pass/fail/skip reasons.
- [ ] **TEST-07 · Planned** — Scenario selection by deep link and an automated collection command with readiness/timeouts.
- [ ] **TEST-08 · Planned** — Semantic dataset/cluster checks; screenshot comparisons restricted to controlled content/provider-specific baselines.
- [ ] **TEST-09 · Planned** — Numeric alignment checks, video capture and native performance/crash trace collection.
- [ ] **TEST-10 · Planned** — Automated MapLibre native SDK builds in CI for Android and iOS; current workflow checks contracts/packages and JS bundles only.
- [ ] **TEST-11 · Planned** — Automated device scenarios and explicit unavailable-provider handling; absence must not count as a pass.
- [ ] **TEST-12 · Planned** — Verify consumer release builds omit development diagnostic interfaces and sensitive data by default.

Evidence: [workflow](.github/workflows/check.yml), [development commands](docs/development.md),
[current scenarios](docs/maplibre-prototype.md). Native build command availability
is separate from a successful remote native SDK build.

## 13. Accessibility and application integration

- [ ] **A11Y-01 · Prototype** — Screen-reader map, marker, cluster and feature semantics on iOS/Android. Fixed iOS annotation wrappers hiding React child labels and reporting map-local frames: child controls now expose screen-coordinate frames, follow camera movement and survive remount on simulator. Full VoiceOver/TalkBack, cluster and feature navigation acceptance remains open.
- [ ] **A11Y-02 · Planned** — Accessible feature navigation, selection and callout controls.
- [ ] **A11Y-03 · Planned** — Reduced motion and pause controls for animations and shader effects.
- [ ] **A11Y-04 · Planned** — Permission denial, location privacy and documented permission ownership.
- [ ] **A11Y-05 · Planned** — Navigation, multiple maps, nested scrolling, bottom sheets and orientation coverage.
- [ ] **A11Y-06 · Planned** — Readable examples/docs and interaction alternatives where GPU picking is unavailable.

## 14. npm distribution, Expo and maintenance

- [ ] **REL-01 · Planned** — Confirm package names/ownership, repository metadata and license; remove placeholder publishing metadata.
- [ ] **REL-02 · Planned** — Clean bare consumers install packed tarballs and build native Debug/Release apps on both platforms.
- [ ] **REL-03 · Superseded** — Apple-only/Google consumer matrix removed; replace with MapLibre native dependency and clean-consumer build coverage under REL-02.
- [ ] **REL-04 · Planned** — Expo config plugin and custom development/production build verification; Expo Go is outside the native package target.
- [ ] **REL-05 · Planned** — Validate exports, autolinking, declarations and peer ranges in real consumers, not only the workspace.
- [ ] **REL-06 · Prototype** — Current setup, package API and shape-limit documentation plus runnable layer/marker examples exist. Complete public API/capability reference and release-ready installation guide remain open.
- [ ] **REL-07 · Planned** — Migration guide, version compatibility matrix and known-limitations documentation.
- [ ] **REL-08 · Planned** — SDK licenses/attribution, dependency audit and distribution requirements checked.
- [ ] **REL-09 · Planned** — Changelog/versioning, prerelease channels, provenance and publishing credential policy.
- [ ] **REL-10 · Planned** — Reproducible bug-report template, security reporting and supported upgrade policy.
- [ ] **REL-11 · Planned** — Explicit release approval and npm prerelease validation; publishing is not authorized by this checklist.

## 15. Discovery backlog and future capabilities

Investigate these explicitly. **Discovery** is not accepted v1 scope; **Deferred**
items are outside the current v1 focus unless the user changes that decision.

- [ ] **DISC-01 · Discovery** — Pinned Mapbox capability inventory and feature-by-feature gap analysis; prioritize additions beyond react-native-maps.
- [ ] **DISC-02 · Discovery** — Vector tile sources and supported style-spec subset; assess feasibility and maintenance cost.
- [ ] **DISC-03 · Discovery** — Feature state, transitions, data-driven styling and source querying beyond the initial expression subset.
- [ ] **DISC-04 · Discovery** — Advanced symbol collision/text shaping, sprites and font management; distinguish package symbols from basemap labels.
- [ ] **DISC-05 · Discovery** — Terrain/elevation, extrusions, globe projection and arbitrary 3D; no shared depth assumption.
- [ ] **DISC-06 · Discovery** — Basemap-label interleaving and provider render-hook access through public APIs.
- [ ] **DISC-07 · Discovery** — Custom offline datasets/tiles versus provider basemap offline downloads; separate technical and licensing constraints.
- [ ] **DISC-08 · Discovery** — MapLibre is now the selected native engine. Additional/custom style and tile sources require explicit contracts, hosting/licensing review and capability decisions.
- [ ] **DISC-09 · Deferred** — Legacy React Native architecture support; New Architecture only is the agreed target.
- [ ] **DISC-10 · Deferred** — Expo Modules/Nitro architecture alternatives; Fabric with TurboModules where needed is the agreed direction.

## Release gates

All gates remain open. Individual completed prototypes above do not close a gate.

- [ ] **GATE-01 · Open** — Feasibility: MapLibre on both platforms, required layers and TypeGPU have measured projection/composition/threading/lifetime paths.
- [ ] **GATE-02 · Open** — Contracts: camera ownership, source/layer/cluster semantics, capabilities, errors and compatibility inventory approved.
- [ ] **GATE-03 · Open** — Features: required v1 functionality implemented with per-provider acceptance coverage.
- [ ] **GATE-04 · Open** — Quality: physical-device release performance, stability, accessibility and size budgets pass.
- [ ] **GATE-05 · Open** — Distribution: clean bare/Expo MapLibre consumers pass; documentation, SDK integration, license and package ownership resolved.
- [ ] **GATE-06 · Open** — Release: remaining limitations accepted and publishing explicitly authorized.

## Progress history

- **2026-10-19** — Created from the agreed design, implementation plans, current code
  and recorded debug/CI evidence. Core maps/camera and static shader texture checks
  are recorded separately from release gates. The live particle prototype was dropped by user direction to prioritize
  the general layer API; sources, production layers, clustering, detailed native gestures
  and release-device budgets remain open. Development command helpers are implemented
  and checked locally; their publication/remote verification is not assumed.

- **2026-10-19** — Added the first Mapbox-like source/layer API with native line/fill
  adapters, independent source/style props, immutable revision checks, bounded
  validation and example controls. Workspace contracts, declaration consumers,
  Codegen and ARM64 native builds passed. Prototype status is retained pending
  broader feature, geographic-edge, lifecycle and release-performance coverage.

## Current MapLibre shape slice — 2026-10-20

Current bounded shape work supplements the source/layer inventory above.

- [x] **SHAPE-01 · Done (bounded API)** — Polygon and Polyline plus geographic Circle; native stroke caps/joins, miter and dash styling on both platforms. Typed tappable callbacks and optional IDs. Workspace checks (41 tests), production bundles and Android/iOS native builds passed. See [shape API and limits](docs/shapes.md) and [verification](docs/verification.md).
- [ ] **SHAPE-02 · Prototype** — Reauthorized running iOS/Android simulators passed visible Circle/Polygon/dashed Polyline selection smoke checks. Full matrix for holes, ordering, style replacement, geometry updates, press coordinates, antimeridian circles and performance remains open.
- [ ] **SHAPE-03 · Planned** — Broader RN Maps parity: CSS colors, geodesic lines/polygons, gradient strokes and dash phase.

## Latest checklist review

- **2026-10-20 · Checklist reconciliation** — Reviewed current public exports, Fabric specs,
  native MapLibre hosts, marker implementation, scenario docs and workflow. Reopened
  camera/raster/provider claims invalidated by migration, recorded source/layer/marker
  and picking subsets, and kept production, device and release gates open. Earlier
  build/test counts in this file are attributed to recorded evidence, not new runtime
  verification. No simulator/device interaction was performed for this review.

- **Fresh local verification** — `npm run test:contracts` passed all 41 tests (including TypeScript package builds and standalone native helper tests). Native SDK builds, production bundles and device scenarios were not rerun for this documentation review.

- **2026-10-20 · SRC-03 implementation** — Added explicit revision transport and
  map-owned Java/C++ gates, batch validation before native resource removal,
  accepted-scene replay on style reload and lifecycle guards. Regression coverage
  includes signed zero, safe-integer bounds, stale/equal revisions, rejected batches,
  independent maps, unversioned sources, removal/re-addition and disposal.
  See [source revision contract](docs/source-revisions.md) and [verification log](docs/verification.md).

- **2026-10-20 · GEST-05 implementation slice** — Replaced delayed marker responder polling with initial native target ownership. Standalone Android stream regression and iOS/Android SDK builds passed; full GEST-05 remains open pending integrated device coverage.

- **2026-10-20 · ARCH-07 implementation** — Added native capability reports and public ref/callback access. Readiness request IDs reject delayed reports after style replacement, URL reuse or detach. Existing feature quality gates remain open.

- **2026-10-20 · SRC-06 scene budgets** — Added aggregate source/shape/layer position and UTF-8 payload bounds. Regression fixtures reproduce previously accepted oversized combinations and cover all geometry kinds and Unicode widths. Broader native input/cancellation and performance gates remain open.

- **2026-10-20 · CAM-06 native provenance** — Added SDK-derived idle origins with unknown fallback, Android consuming tracker and iOS native reason-mask classification. Detailed native gestures and integrated device timing remain open.
