# Shader raster scenario

Build/install both example apps as in development.md, including Google iOS.
Start Metro on 8088. Enable Shader on. The GPU status must become ready and a
transparent blue triangle must be visible over central Warsaw. Turn Live off,
then use Camera path to cycle zoom, heading and pitch. Change Shader color,
remove/re-add the shader, remount, and background/resume. Drag starting over the
triangle: the map must receive touches. Run with Apple and Google on iOS.

## Agent interface

Development builds expose `globalThis.__enhancedMapScenario` to Metro CDP:

```js
const s = globalThis.__enhancedMapScenario;
s.live(false);
s.shader(true);
s.color(false); // false = blue, true = pink
s.remount();
// Poll snapshot() until status and shaderStatus both equal 'ready'.
// Re-read globalThis.__enhancedMapScenario after React renders: callbacks and
// snapshot closures intentionally represent the latest committed example state.
globalThis.__enhancedMapScenario.snapshot();
globalThis.__enhancedMapScenario.move(1); // zoom 13, heading 90, pitch 45
// After settlement, changes should remain 0, idle should increase.
// Verify screenshot: transparent triangle rotates/tilts with the geographic map.
globalThis.__enhancedMapScenario.color(true);
// Await shaderStatus ready, then verify screenshot becomes pink.
globalThis.__enhancedMapScenario.shader(false);
// Await shaderStatus off; screenshot must have no triangle.
```

`move(0..3)` selects a deterministic camera step. `provider('apple'|'google')`
switches provider (iOS only for Apple); wait for readiness after switching.
`remount()` resets event counters. Snapshot returns status, dimensions and counts;
it excludes API keys, coordinates and image bytes. Existing
`__enhancedMapDiagnostics` provides bounded event timestamps. Both globals are
inside `__DEV__` guards and are not package APIs.

Record full screenshots separately per provider and camera step. MapKit's
provisional camera-distance conversion is not equal to Google's zoom; do not
compare pixels between providers as though the camera projections matched.
Current screenshots establish visual feasibility, not a numeric alignment bound.
Use stable provider-specific baselines for future screenshot-diff runs.

## Limits

This scenario executes a one-shot shader and transfers at most 256 KiB raw image
bytes per replacement before base64 overhead. It does not stream camera frames or
re-render the GPU shader on a camera update. Shader baking currently creates a GPU
device per request; benchmark and pool resources before frequent updates.
No FPS, physical-device release performance, memory-stress, shared-depth or live
shader-loop acceptance is claimed. Native SDK overlay projection is used instead
of reconstructing a matrix from camera events.
