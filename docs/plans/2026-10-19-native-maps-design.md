# React Native Enhanced Maps: v1 design

Status: agreed direction; detailed API and feasibility remain unvalidated.

## Objective

Publish a typed React Native maps library whose priorities are stability and measured performance. Support Google Maps on Android, Google Maps on iOS, and Apple MapKit on iOS. Target React Native New Architecture only, using Fabric views and TurboModules with Codegen. No custom basemap provider in v1.

## Required v1 scope

- Familiar react-native-maps components and camera methods, with explicitly tested behavioral compatibility rather than a blanket drop-in claim.
- Native gesture recognition and camera movement provenance, including cancellation and SDK-originated movement.
- Native clustering integrated into point sources.
- Sources and layers: GeoJSON, raster tiles, circle, symbol/icon, line, fill, raster, and heatmap. Include a bounded expression language, feature picking, visibility, ordering, and incremental updates.
- TypeGPU custom shader layers, delivered as an optional companion installation but maintained and tested as part of v1.
- Complete TypeScript public APIs, published declarations, native boundary specifications, runtime validation, and type tests.
- Development tooling that allows humans and AI agents to reproduce scenarios and inspect results.

No promise of full Mapbox style-spec parity, basemap label interleaving, shared provider depth buffers, arbitrary 3D rendering, terrain, or offline basemap downloads. These require separate capabilities and evidence. If mandatory shader behavior cannot be achieved, report the blocker and revise the release scope with the user; do not silently remove shaders.

## Package structure

Provisional npm names; availability and ownership have not been checked:

- `packages/maps`: react-native-enhanced-maps. TypeScript facade, Fabric components, native adapters, sources, clustering, and ordinary layers.
- `packages/typegpu`: @react-native-enhanced-maps/typegpu. Adapter between map projection/lifecycle and TypeGPU rendering.
- `example`: native application and reproducible scenario laboratory.
- `fixtures`: deterministic datasets and expected semantic results.
- `scripts`: checks, consumer installation, scenario artifact collection, and release tooling.

React and React Native are peer dependencies. The companion uses tested peer ranges for TypeGPU and react-native-webgpu. Peer dependencies still add application weight when installed. Keep @typegpu/react optional unless it materially simplifies the proven implementation. Do not add Expo Modules, Nitro, Reanimated, Worklets, Skia, Three.js, or a clustering library without a recorded need and size/maintenance assessment. A worklet runtime may be justified by the threading spike; independence from application JavaScript is not assumed.

Google Maps must be optional on iOS for an Apple-only consumer. An Expo config plugin may configure native installation without using Expo Modules. Expo support means custom development/production builds, not Expo Go.

## Native architecture

Fabric owns map view mounting, layout, props, events, and view commands. Add TurboModules only for operations requiring a module interface; do not duplicate every view command there. Keep native SDK adapters thin and explicit. Swift/Kotlin may contain platform logic; use Objective-C++/C++ integration where required by Fabric/Codegen. Codegen specifications use supported types, not the entire expressive public TypeScript API.

Provider-neutral state includes source revisions, feature identifiers, style definitions, camera requests, capability reports, and lifecycle generations. Translate it into each provider's primitives. Keep expensive dataset processing outside UI threads; perform SDK view mutations on their required UI thread. Never serialize a complete source for every camera frame.

Each map owns its sources, jobs, listeners, and associated GPU resources. Every asynchronous result carries map generation and source revision. Obsolete results are discarded after source replacement or disposal. Teardown is idempotent. Bound caches, rendering counts, and outstanding work; define backpressure for updates arriving faster than processing.

## Camera and gestures

Define precedence among initial camera, controlled region/camera, imperative commands, gestures, and SDK controls. Avoid uncontrolled feedback between camera callbacks and prop updates. Specify interruption, completion, cancellation, and behavior before readiness or after disposal.

Movement origins are gesture, application command, SDK control, or unknown. Detailed pan/pinch/rotate/tilt recognition is a separate capability from identifying gesture-driven camera movement. Do not infer a definitive gesture kind from camera deltas alone. Validate simultaneous gestures, cancellation, nested scrolling, bottom sheets, and screen navigation without private SDK view inspection.

## Sources, layers, and clustering

Use stable feature IDs and source revisions. The bulk data API is separate from convenient React child markers. Define full replacement and incremental insert/update/delete semantics and errors. Validate malformed geometry and non-finite coordinates. Specify GeoJSON longitude/latitude order, antimeridian wrapping, polar limits, holes, multipolygons, and feature property types.

Define a small typed style expression subset before implementing it: literal values, feature property lookup, match/step/interpolation where justified, and zoom. Reject unsupported expressions explicitly. Specify layer ordering among our content separately from placement against provider basemaps. Describe symbol collision behavior and text/font support; do not imply Mapbox label-layout parity.

Prefer consistent clustering semantics across providers. Benchmark a shared native index/algorithm against provider utilities before selecting implementation. Specify radius units, zoom model, stable cluster identifiers within a revision, expansion behavior, property aggregation, and update invalidation. Include deterministic expected memberships in fixtures.

Picking returns typed feature IDs/properties, source/layer identity, coordinates, and screen point. Specify hit radius, ordering of overlapping hits, and interaction between ordinary and shader layers. Shader feature picking requires an explicit mechanism; it is not automatic.

## TypeGPU integration

Start by validating a transparent GPU surface associated with each map. Do not assume native map SDKs expose a renderer hook, a shared GPU device, a depth buffer, or a complete view-projection matrix.

The integration contract needs viewport dimensions in logical and physical pixels, pixel ratio, padding, projection/camera state, coordinate helpers, timestamps, frame scheduling, lifecycle signals, and resource ownership. Validate high-zoom coordinate precision using a local origin or high/low decomposition as needed. Test different provider projection behavior, camera tilt, rotations, world wrapping, and animated transitions.

TypeGPU supplies typed GPU buffers and shader pipelines. It does not itself guarantee rendering or camera synchronization outside the application JS runtime. Determine the smallest viable scheduling mechanism through measurements. Prefer stable object/buffer ownership over per-frame allocations or readbacks. Handle initialization failure, shader compilation/validation errors, device loss, backgrounding, and GPU recovery without taking down the ordinary map.

First effect: seeded geographic anchor points plus animated particles. Render known anchors using provider-native markers and GPU geometry so screen-space alignment can be measured. Keep shader content off attribution/controls. Initially describe composition as an overlay; advertise deeper integration only after proof.

## Verification architecture

Scenario selection accepts provider, dataset, seed, and camera path through a development deep link. A development-only diagnostics interface exports readiness, source revisions, feature/cluster counts, event sequence, pending jobs, camera samples, GPU status, and resource counters. Disable it in consumer release builds. Redact credentials and location data by default.

Each run produces a JSON result with scenario version, commit, device/OS, RN/SDK versions, build mode, seed, measurements, and pass/fail reasons. Capture screenshots/video, native logs, crash reports, and available performance traces alongside it. Distinguish skipped/unavailable providers from passes.

Use native tests for algorithms and lifecycle state; type tests for API contracts; device tests for SDK behavior. Screenshots alone cannot verify clustering, provenance, or resource release. Basemap imagery changes; use semantic checks and controlled overlays rather than whole-map pixel equality.

Measure release builds on physical Android and iOS devices. Record p50/p95/p99 frame time, dropped frames, memory after repeated cycles, source update latency, camera alignment error, application size, and build cost. Select numeric thresholds before evaluating candidate implementations. Baseline equivalent react-native-maps and native-only scenarios before claiming improvements. Simulator timing is diagnostic, not release performance evidence.

Include screen-reader semantics for features, reduced motion, permission denial, multiple maps, screen transitions, nested gestures, repeated mount/unmount, resize, and background/resume.

## Release gates

1. Feasibility: all three providers and TypeGPU pass documented projection, threading, lifecycle, and composition checks. Choose supported OS, RN, native SDK, and GPU runtime versions from evidence.
2. Contracts: approve camera ownership, source/layer semantics, capabilities, errors, threading, and compatibility inventory.
3. Core and features: implement in vertical slices with acceptance tests on all three backends. Layers and shaders remain required v1 scope.
4. Release: packed tarballs install and build in clean bare and Expo consumers, including Apple-only iOS without Google. Verify declarations, exports, autolinking, native source inclusion, release builds, licensing, attribution, credential setup, and migration guide.
5. Maintenance: document tested version ranges, SDK upgrade policy, release channels, reproducible bug reports, and security reporting. Publishing requires package ownership and credentials; no publishing is authorized by this design alone.

## Reference material

- React Native Codegen/TurboModules: https://reactnative.dev/docs/turbo-native-modules-introduction
- react-native-maps API baseline: https://github.com/react-native-maps/react-native-maps
- Google iOS events: https://developers.google.com/maps/documentation/ios-sdk/events
- Google Android events: https://developers.google.com/maps/documentation/android-sdk/events
- Google iOS tile layers: https://developers.google.com/maps/documentation/ios-sdk/tiles
- MapKit tile overlays: https://developer.apple.com/documentation/mapkit/mktileoverlay
- TypeGPU React Native: https://docs.swmansion.com/TypeGPU/integration/react-native/
- Mapbox source/layer model: https://docs.mapbox.com/ios/maps/guides/styles/work-with-layers/

These are research entry points, not pinned implementation dependencies. Recheck supported versions during the spike.
