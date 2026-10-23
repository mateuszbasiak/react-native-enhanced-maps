> Dropped by user decision after CPU reference measurements. SDK-native components and provider-limited zIndex are the current direction. See ../native-components.md.

# Shared native renderer feasibility implementation plan

**Goal:** Implement the user's selected strict zIndex ordering and standalone component authoring for Polyline, Polygon, Heatmap and ParticleLayer, with a native reference renderer on all three providers.

**Approved direction:** One shared native surface for package-owned content. Native SDK marker/annotation prototypes, basemap labels, buildings and the old raster experiment are outside this ordering contract. The surface is not an SDK render pass and frame-perfect camera synchronization remains a measurement gate.

**Architecture:** React elements compile into a bounded immutable scene sent as one Fabric string prop. Native map host owns a transparent, touch-through native view, SDK projection callback, retained geometry/effect data and native animation scheduler. Native Canvas/CoreGraphics is a reference backend, not a production GPU implementation. No per-frame JS transport, GPU performance claim or fake Heatmap/ParticleLayer exports. Existing legacy source/layer/native paths remain internal for comparison until the reference path is evaluated; new public authoring uses standalone components.

**Tech stack:** React/Fabric, Kotlin Canvas/Choreographer, Objective-C++ CoreGraphics/CADisplayLink, Google SDK projection and MKMapView conversion. No new runtime dependencies.

## Scene boundary (version 1)

`{version:1,items:[...]}`. Items sorted ascending by zIndex; ties retain declaration order. Every item has `id`, `type`, `zIndex` (finite -1e6..1e6), `visible` (bool), `opacity` (0..1).

- polyline: `coordinates:[{latitude,longitude}]`, `strokeColor:'#RRGGBB[AA]'`, `strokeWidth` in layout points 0..256.
- polygon: `coordinates` outer closed ring, `holes` array of closed rings, `fillColor`, `strokeColor`, `strokeWidth`.
- heatmap: `points:[{latitude,longitude,weight}]`, `radius` in layout points 1..128, `intensity` 0..100. Reference density grid at most 128x128 with weighted Gaussian kernels and blue/green/red ramp, cached until projection/data changes. Opacity applied at composition.
- particles: `field:{bounds:{north,south,east,west},columns,rows,vectors:[{u,v}]}`, row zero north, vector east/north meters/sec; `particleCount` 1..512, `speedFactor` 0..100, `color`, `particleSize` 0.5..16 layout points, `trailLength` 1..16, `paused` bool. Bilinear velocity sampling, geographic integration, bounded deterministic respawn and cached per-particle trails. Field bounded to Mercator latitudes ±85, non-wrapping; global coverage only exists where input velocity data exists.

Limits: 64 items; 10000 total geometry/heat points; 2048 heat points; max 64x64 vector grid, finite vectors |u|/|v|<=200, at most 1024 total particles; source payload 2 Mi UTF-16 code units. Native validates independently before replacement and keeps prior scene on malformed input. Large data, globe/terrain, world edges and production GPU backend are outside reference acceptance.

## Tasks

1. Test scene compilation, native-safe limits, stable zIndex/tie ordering, wind sampling/integration fixtures and no-mutation behavior. Implement typed standalone components and remove legacy source/layer authoring from public exports/example/type cases.
2. Android native reference view: parse/validate before replacement, retain particle states across style/z changes, cache projected static paths and heat density, native frame scheduling only for active particles, lifecycle cleanup, reserved control/attribution areas. Integrate a `renderScene` prop into existing native map host without modifying marker prototype behavior.
3. iOS native reference view with the same contract and semantics for MapKit and Google. Same projection/cache/lifetime rules and independent native ticks.
4. Add optional `onRendererStats` event (frames, drawCpuMs, projectionCpuMs, maxDrawCpuMs, heatRebuilds, running) at most once/second with no payload work absent a subscriber. These are CPU instrumentation, not GPU/display FPS.
5. Update example controls/scenario for all four types with overlapping content; reverse zIndex, pan/zoom/tilt, hide/remove, pause, background/resume, and block JS to verify native advancement. Keep marker benchmark entry point intact.
6. Review implementation, run workspace/type/Codegen/package/bundle checks and ARM64 native builds; run debug device scenarios separately for each provider. Record feasibility evidence and unresolved alignment/performance limits. Do not promote production acceptance from debug results.
