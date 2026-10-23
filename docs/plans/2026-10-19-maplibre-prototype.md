# MapLibre Native Prototype Implementation Plan

**Goal:** Evaluate a shared basemap and application-layer renderer in the existing example.

**Architecture:** Use the MapLibre Native React Native binding in an isolated example screen. Keep existing native providers unchanged. Vector basemap and GeoJSON route/vessels are native style layers. Camera animation executes in MapLibre; no camera events are used to position features.

**Tech Stack:** React Native 0.85/Fabric, MapLibre React Native 11.5, MapLibre Native.

## Tasks

1. Install an exact version of the binding in the example; inspect its installed API.
2. Add deterministic fleet/route fixtures with tests for count, identity, geographic validity, and invalid counts.
3. Add prototype screen: vector basemap, route below labels, native vessel symbol layer, count controls, camera pitch/rotation path, ordering toggle, ready/error state and remount.
4. Link screen from existing example without changing provider contracts.
5. Run fixture tests, workspace checks and release JS bundles; install pods/build native targets where tooling permits.
6. Document observed validation and limitations. This baseline does not claim custom GPU integration, native vessel animation, collision integration, or measured throughput.

## Acceptance

- One native renderer owns map and custom style layers.
- Fleet sizes 100/1,000/10,000; stable IDs and deterministic data.
- Route can switch below/above controlled basemap labels.
- Camera supports zoom, rotation, pitch without feature projection through JS.
- Existing map screens remain accessible.
- No production tile service or renderer performance claims from demo infrastructure.
