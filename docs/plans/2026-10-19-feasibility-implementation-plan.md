# Native maps and TypeGPU feasibility implementation plan

> Execution guidance: use superpowers:executing-plans to implement this plan task-by-task. This plan does not authorize publishing.

**Goal:** Establish whether a small Fabric/TurboModules maps package can support typed layers and geographically aligned TypeGPU effects on Google Android, Google iOS, and MapKit.

**Architecture:** A TypeScript facade hosts native maps through Fabric, with native adapters and TurboModules only where needed. A companion package associates a transparent WebGPU surface with the map and evaluates camera synchronization without assuming renderer access or JS-independent execution.

**Tech stack:** React Native New Architecture, TypeScript/Codegen, platform map SDKs, native integration languages, TypeGPU and react-native-webgpu. Exact versions are selected and locked during Task 1.

## Execution rules

The repository initially has no implementation. Commands below are scripts to create, not tools that already exist. Every proposed check must be implemented before reporting it as executed. No runtime or SDK version is approved yet. Task 1 must produce a runnable toolchain; refine subsequent native filenames against that scaffold before editing them.

Keep each numbered action independently reviewable. Use meaningful failing contract tests before behavior changes, then run the matching check after implementation. Do not test documentation or scaffold boilerplate with implementation-mirroring assertions. Save evidence after every device run. Missing hardware, credentials, or toolchains must be reported explicitly.

### Task 1: Establish reproducible toolchain and packages

Files: create `package.json`, `package-lock.json`, `.gitignore`, `packages/maps/package.json`, `packages/typegpu/package.json`, `docs/development.md`, and `docs/compatibility.md`.

1. Inspect available Node/npm, Xcode, Android SDK/JDK, simulators/devices, and credentials presence without printing secret values.
2. Verify current official RN, map SDK, TypeGPU, and WebGPU installation requirements. Pick one mutually supported version set and record sources and versions.
3. Create npm workspaces, strict TypeScript configuration, exports/declaration build, and explicit peer ranges. Keep native bindings private until they are usable; do not publish a placeholder map.
4. Add root scripts `typecheck`, `build`, `test:contracts`, and `pack:check`. Implement `scripts/check-package.mjs` to inspect packed files, exports, and declaration resolution in a temporary consumer.
5. Run `npm ci`, `npm run typecheck`, `npm run build`, and `npm run pack:check`. Expected: successful dependency resolution, declarations generated, pack contents validated. Record blockers if installation cannot run.
6. Commit this foundation after reviewing package manifests and lockfile for accidental runtime dependencies.

### Task 2: Define typed contracts and capability inventory

Files: create `packages/maps/src/types.ts`, `packages/maps/src/index.ts`, `packages/maps/src/specs/MapViewNativeComponent.ts`, `packages/maps/type-tests/public-api.tsx`, `packages/typegpu/src/types.ts`, `fixtures/scenarios.json`, and `docs/contracts.md`.

1. Record camera ownership, origins, command results, readiness/errors, feature/source revisions, and supported provider combinations.
2. Add positive type cases plus `@ts-expect-error` cases for invalid provider options, malformed layer props, and incorrect event payloads. Run `npm run typecheck`; expect failure until contracts exist.
3. Implement the public types and narrow Codegen-compatible boundary. Keep provider-specific options discriminated and distinguish unavailable capabilities from false values.
4. Run type checking and native Codegen for both platforms. Expected: public examples compile, negative cases remain errors, generated interfaces build.
5. Create a pinned react-native-maps compatibility inventory; mark every item supported, partial, deferred, or unvalidated. Do not claim compatibility from type matching alone.
6. Commit the contracts and generated-code policy; generated consumer build artifacts should not be committed accidentally.

### Task 3: Mount real native maps on three backends

Files: create `example/`, native implementation directories `packages/maps/ios/` and `packages/maps/android/`, platform registration/build files, and `example/src/scenarios/MapLifecycle.tsx`.

1. Generate a bare RN example using the selected version and wire workspace package resolution.
2. Implement the smallest Fabric map view per provider, with readiness/error events, initial camera, layout, and disposal.
3. Configure Google credentials outside committed sources and optional Google iOS linking. Add documented errors for missing configuration.
4. Add a scenario that mounts, resizes, unmounts, and remounts each provider and captures readiness/disposal counts. Verify failure handling before marking it passing.
5. Run iOS and Android debug and release builds using documented native commands. Expected: all three actual SDK views display; Apple-only consumer builds without Google iOS binaries.
6. Save logs/screenshots and commit the vertical slice. This establishes integration, not performance.

### Task 4: Add deterministic scenario control and diagnostics

Files: create `example/src/harness/ScenarioRunner.ts`, `example/src/harness/Diagnostics.ts`, `scripts/collect-scenario.mjs`, `fixtures/camera-paths.json`, and `docs/testing.md`.

1. Define a result schema containing scenario/seed/provider, build and device identity, check results, measurements, artifact paths, and explicit skip reasons.
2. Test malformed scenario inputs, timeout, skipped provider, and failure result serialization through `npm run test:contracts` before implementation.
3. Add deep-link selection and a development-only diagnostics snapshot. Redact credentials and coordinates by default.
4. Add `npm run scenario:collect -- --provider <provider> --scenario <scenario> --seed 1`; document device prerequisites. Collection must use actual exported diagnostics, not fabricate semantic state from screenshots.
5. Run lifecycle scenario on each backend. Expected: structured pass/fail JSON plus logs and screenshots, with repeatable seed and scenario version.
6. Verify release consumers omit the diagnostics entry point and commit.

### Task 5: Prototype geographic TypeGPU rendering

Files: create `packages/typegpu/src/MapGpuLayer.tsx`, `packages/typegpu/src/projection.ts`, `packages/typegpu/src/lifecycle.ts`, `example/src/scenarios/GpuAnchors.tsx`, and `example/src/scenarios/GpuParticles.tsx`.

1. Verify a transparent TypeGPU/WebGPU surface works on the locked runtime and both platforms. Do not assume a GPU context can be shared with map SDKs.
2. Add projection reference tests for known coordinates, viewport pixels, padding, wrapping, and precision. Run `npm run test:contracts`; expect failure until implemented.
3. Implement a provisional projection/context interface and draw geographic anchors next to provider-native markers.
4. Exercise zoom, tilt, rotation, camera animation, resize, antimeridian crossing, and high zoom on all three backends. Record physical-pixel error and limitations.
5. Add seeded particle animation and structured GPU status/errors; test disposal and reinitialization. Shaders execute on GPU; submission thread independence remains unproven.
6. Run builds and type checks; retain screenshots/videos and measurement JSON. Commit prototype with explicit provisional API status.

### Task 6: Establish threading, lifecycle, and size acceptance

Files: create `example/src/scenarios/JsContention.tsx`, `example/src/scenarios/ResourceStress.tsx`, `scripts/report-size.mjs`, and `docs/benchmarks/feasibility.md`.

1. Select physical reference devices and numeric acceptance thresholds before evaluating results: frame times, overlay alignment, source latency, memory drift, and allowed size impact. Record warmup, duration, repetitions, and measurement method.
2. Measure idle and controlled busy-JS workloads in release builds. Record camera timestamps and GPU presentation/submission evidence; do not infer synchronization from FPS alone.
3. Run at least 100 mount/unmount cycles, repeated background/resume, multiple maps, and interruption during initialization. Inspect native memory/resource traces after warmup.
4. Compare core-only and TypeGPU consumer app sizes, npm tarball sizes, native dependencies, and clean/incremental build costs.
5. If JS contention fails, evaluate the smallest viable native scheduling or worklet solution; record tradeoffs before adding dependencies. Re-run affected checks after each change.
6. Commit measurements and the scheduling decision. A simulator-only result cannot satisfy the physical-device gate.

### Task 7: Verify layers, picking, and clustering feasibility

Files: create `example/src/scenarios/LayerCapabilities.tsx`, `example/src/scenarios/ClusterScale.tsx`, `fixtures/geojson/`, and `docs/layer-capabilities.md`; add provisional adapter implementations under the maps native directories.

1. Define fixtures with known feature IDs, polygon holes, overlapping hits, dense clusters, and antimeridian geometry. Establish expected semantic results independently of the implementation.
2. Test native representations of circle, symbol/icon, line, fill, raster, and heatmap on each provider; document when GPU rendering is required.
3. Verify ordering, updates/removal, picking, expression evaluation, and interaction between normal and GPU layers.
4. Benchmark candidate clustering strategies with 1k/10k/100k input points and bounded output. Measure full replacement and small updates, cancellation, deterministic membership, and native thread usage.
5. Run identical fixtures on all three backends and collect artifacts. Expected: each required capability has a proven implementation path or a specific unresolved blocker.
6. Commit the capability inventory and algorithm/rendering decisions.

### Task 8: Decide feasibility and expand the production plan

Files: update the design and risk register; create `docs/plans/2026-10-19-v1-delivery-roadmap.md` after evidence exists.

1. Review every critical risk against actual artifact paths. Mark pass, fail, or blocked; never mark missing evidence as pass.
2. Freeze OS/RN/SDK support, camera semantics, layer specification, GPU composition limits, threading, and dependency policy only where proven.
3. Break production work into tested vertical slices: core maps/camera, native gestures, source updates, clustering, all required layers, TypeGPU extension, accessibility, and release tooling.
4. Define per-slice native/type/device checks and clean-consumer installation checks, including bare and Expo builds and Apple-only iOS.
5. Plan npm prerelease validation, provenance, package ownership, release credentials, license/attribution requirements, and maintenance policy. Publishing remains a separate explicit action.
6. Report the evidence-backed go/no-go decision. Required layers or TypeGPU blockers require user scope decisions rather than quiet deferral.

## Completion definition for this plan

The plan is complete only after runnable prototypes, three-backend evidence, physical-device measurements, package size/install evidence, and a recorded feasibility decision exist. Writing this document does not establish any SDK or shader capability as working.
