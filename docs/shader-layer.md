# ShaderLayer

`ShaderLayer` is an experimental `MapView` child for world-anchored WGSL effects on iOS and Android. The same shader sources run through react-native-webgpu on both platforms. A dedicated React Native Worklets runtime encodes and submits animation frames; React supplies configuration and input changes.

Install `react-native-webgpu@0.17.0` and `react-native-worklets@0.12.2` in the application, add `react-native-worklets/plugin` last in the Babel plugins, install pods and rebuild native apps. Reset Metro's transform cache when adding the plugin. Use the dedicated `/shaders` entry point to keep GPU imports outside ordinary maps. These are optional peers for ordinary maps; mounting a shader layer requires both runtimes. Android's shared-output transport requires API 26+ and compatible writable native texture sharing.

```tsx
import { MapView } from 'react-native-enhanced-maps';
import { ShaderLayer } from 'react-native-enhanced-maps/shaders';

const fragment = /* wgsl */ `
@fragment fn fragmentMain(
  @location(0) uv: vec2f,
  @location(1) world: vec2f
) -> @location(0) vec4f {
  let wave = 0.5 + 0.5 * sin(world.y * 25735.927 - frame.time * 2.0);
  let alpha = wave * 0.3;
  return vec4f(vec3f(0.05, 0.5, 1.0) * alpha, alpha);
}`;

<MapView styleURL={styleURL}>
  <ShaderLayer id="waves" shaders={{ fragment }} placement="below-labels" />
</MapView>;
```

## Coordinates, stages and inputs

Coverage is the Mercator world, with repeating longitude. This is a planar map, not a spherical globe; polar regions outside Web Mercator are excluded. `bounds` from the earlier rectangle experiment is removed. Native camera projection anchors output tiles; the shader receives tile-local `uv` and normalized, unwrapped Mercator `world` through the default fullscreen vertex stage. Use world coordinates for continuous effects. An arbitrary function of tile-local UV can still create seams.

Every shader stage is prefixed with a declaration of `frame` at group 0 / binding 0:

```wgsl
struct MapShaderFrame {
  time: f32, delta: f32, resolution: vec2f,
  tileOrigin: vec2f, tileScale: f32, tileZoom: f32,
  viewMin: vec2f, viewMax: vec2f,
};
```

Do not redeclare this binding. `time` is accumulated active simulation seconds, `delta` is the submitted step capped at 50 ms, and `resolution` is the tile interior (252²). Camera bounds are normalized Mercator coordinates, with y increasing southward. Time advances only when an output lease is available. Long stalls intentionally discard excess elapsed time. Pausing freezes time and compute while rendering remains available for camera/input changes.

Injected helpers are `mapWorldPosition(uv)`, `mapTilePosition(world)` (world point to tile clip position, selecting the nearest longitude copy), and `mapLngLat(world)` (longitude/latitude in degrees).

Binding 1 is a 4096-byte uniform buffer. Declare your WGSL layout at `@group(0) @binding(1)` and pass packed f32 values through `uniforms`. Follow WGSL alignment/padding rules; up to 1024 finite values are accepted. Trailing values are cleared. A uniform callback must contain `'worklet'`; it receives `{time, delta, width, height}` and executes on the rendering runtime. React input packets update without recreating the simulation.

Optional `shaders.vertex` replaces the default fullscreen triangle. Entry names default to `vertexMain`, `fragmentMain`, and `computeMain`. Rendering uses triangle lists with configurable `vertexCount` (default 3) and `instanceCount` (default 1). Output colors must use premultiplied alpha.

## Persistent simulation and tile boundaries

Optional `shaders.compute` runs once per submitted frame, before all tile render passes. `simulation` provides `byteLength`, optional packed f32 `initialData`, and `workgroups`. The allocation is one layer-wide storage buffer at group 0 / binding 2: declare it read-write in compute and read-only in rendering. It is zero-initialized and bounded to 16 MiB. Custom storage layouts and deterministic initialization are the programmer's responsibility.

The wind example in `example/gpu/webgpuShader.ts` maintains positions and tail endpoints in that buffer. Tile changes do not reset particles; every tile draws the same state with its own projection. A particle crossing an edge is drawn into both intersecting tile outputs. The example shifts both trail endpoints together at the antimeridian and retires/respawns particles outside a padded visible region. Its velocity is procedural, not forecast data.

Each layer owns a triple-buffered 1024² atlas (12 MiB raw pixel storage), with at most sixteen 252² tile interiors and two-pixel gutters. Tile zoom is lowered to fit coverage and a margin within that budget. A completed atlas and its tile metadata are published atomically; native renderers retain output leases until their GPU reads finish. There is no CPU pixel readback and no per-frame RN bridge call. Completion currently waits on the GPU queue on the worklet runtime; native fence handoff is future optimization.

Simulation survives camera/tile changes and ordinary uniforms/pause updates. Shader, allocation/draw configuration, placement, style reload and mount changes currently recreate the layer. Atlas swaps retain the old front until the replacement is complete, but do not crossfade different resolutions. Large camera jumps can briefly expose areas until the next atlas is produced. This is bounded rendering, not a weather-data tile cache or texture-streaming API.

## Placement, errors and lifecycle

`beforeId` inserts immediately beneath an existing style layer and takes precedence over `placement`. Missing target IDs and duplicate layer IDs report errors. `placement` defaults to `below-labels`; `above-labels` inserts at the style top. Native iOS annotation markers remain above the map. Arbitrary ordering relative to every React marker is not guaranteed.

`visible={false}` releases layer-owned textures, buffers, shared-memory imports and native atlas pools. One rendering worker is retained for the JS bundle, and clean GPU devices are retained in an idle pool up to peak concurrent layer demand. Each active layer has an exclusive device, preserving GPU-error isolation; later layer lifetimes reuse idle devices instead of repeatedly allocating native contexts. Software-adapter consent is checked for each lease. Backgrounding skips output production and freezes time until active again. `onReady` currently indicates pipeline initialization and native attachment; `onError` reports compilation, runtime, native import or device-loss errors. A failed layer is detached without making the ordinary map unavailable. Correcting shader/configuration props retries initialization. Unexpected device loss now uses bounded automatic recovery, described below. `allowSoftwareAdapter` is an explicit diagnostic opt-in, never hardware performance acceptance.

See [native-context lifetime regression evidence](shader-lifetime-acceptance.md) for the repeated-initialization fix and its memory-observation limits.

The host capability report marks shaders `unvalidated`. Release-device throughput, energy use, high-pitch/horizon coverage, high-zoom precision, resolution-transition quality and full lifecycle stress remain open validation gates.

## Bounded device-loss recovery

An unexpected `GPUDevice.lost` event stops output production, detaches the failed
layer and tears down its textures, shared-memory imports, buffers, native atlas
pool before obtaining a replacement device. The lost device is invalidated and cannot return to the idle pool. Cleanup steps continue if one
throws; a failed cleanup prevents automatic replacement. Cleanup tolerates a rejected queue-completion promise on a lost device. Ordinary maps remain independent of the failed
shader layer.

One shader/configuration effect lifetime permits the initial attempt plus two
automatic replacements, separated by 100ms and 500ms retry waits. A third loss
reports recovery exhaustion and leaves the layer detached. Remounting or changing
a resource-owning configuration starts a fresh lifetime. Uniform/pause changes do
not reset this budget. Intentional destruction during disposal does not retry;
ordinary shader validation, compilation, import and runtime errors also do not
trigger this device-loss policy. Hiding/removing the layer or replacing its host
cancels pending retry waits. No new public retry prop is added. Replacement uses another healthy idle device when available; otherwise it requests a fresh adapter and device, consistent with the [WebGPU device-loss model](https://gpuweb.github.io/gpuweb/explainer/).

`onError` reports each unexpected loss; `onReady` runs again after a replacement
pipeline is initialized and attached. Readiness is not proof of a submitted frame.
The old GPU state cannot be retained after device loss: simulation storage is
reinitialized from `initialData`, and simulation time restarts at zero. Current
uniforms, paused state and application activity are applied to the new attempt.

The Debug WebGPU fixture has a “Simulate device loss” control and bounded
`__enhancedMapsWebGPU` snapshot/control interface. Its `lose()` calls the same loss
handler and intentionally destroys the device. This verifies the package's
teardown/reinitialization path; it does not reproduce an actual driver failure or
establish physical-device robustness. The underlying per-layer injection registry
and fixture interface are absent from production bundles. Android software
adapters still require explicit diagnostic opt-in and do not establish hardware
performance or acceptance.

### Recovery verification, 2026-10-25

Five contracts cover bounded retry counts/waits, disposal before/during a retry,
complete cleanup despite errors or throwing application callbacks, cleanup-before-
replacement ordering, and suppression of recovery after failed cleanup. Full local
CI passes 128 tests, strict types, lint/format, Codegen, packed-package checks and
both production bundles with Debug helpers excluded. Independent review found no
actionable correctness issues.

Source `5853422` used compatible existing native Debug binaries from `9076f0c` on
iPhone 17 Pro/iOS 26.1 and Pixel 9a ARM64/API 36. Android first rejected its
software adapter as expected, then used explicit diagnostic opt-in. Each host
completed the same nine recorded checkpoints: exhausted with zero pools; remount
with one pool; first and second replacements with one pool; exhausted again with
zero pools; another remount; hidden during recovery with zero pools and no new
ready callback after a one-second observation; shown with one pool; final disposal
with zero pools and no injection registry. Native produced and sampled counters
were positive after each initialized/recovered checkpoint. Ready counts progressed
3→4→5→6, stayed 6 on exhaustion, then 7, stayed 7 while hidden, and reached 8 when
shown. Those counts are fixture callbacks, not frame-time measurements.

These are deliberate fault-injection and pool-lifetime checks, not actual GPU
driver-loss, full memory accounting, performance or physical-device acceptance.
Broader initialization, shader-edit, background, style, multiple-layer and lifetime
stress coverage remains open under GPU-12.
