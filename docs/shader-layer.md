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
  zoom: f32, padding0: f32, padding1: f32, padding2: f32,
};
```

Do not redeclare this binding. `time` is accumulated active simulation seconds, `delta` is the submitted step capped at 50 ms, and `resolution` is the tile interior (252²). Camera bounds are normalized Mercator coordinates, with y increasing southward. Time advances only when an output lease is available. Long stalls intentionally discard excess elapsed time. Pausing freezes time and compute while rendering remains available for camera/input changes.

Injected helpers are `mapWorldPosition(uv)`, `mapTilePosition(world)` (world point to tile clip position, selecting the nearest longitude copy), and `mapLngLat(world)` (longitude/latitude in degrees). For particles stored as a world origin plus a small local offset, use `mapRelativeTilePosition(origin, offset)` to avoid losing subpixel precision before tile projection.

Binding 1 is a 4096-byte uniform buffer. Declare your WGSL layout at `@group(0) @binding(1)` and pass packed f32 values through `uniforms`. Follow WGSL alignment/padding rules; up to 1024 finite values are accepted. Trailing values are cleared. A uniform callback must contain `'worklet'`; it receives `{time, delta, width, height, zoom}` and executes on the rendering runtime. React input packets update without recreating the simulation.

Optional `shaders.vertex` replaces the default fullscreen triangle. Entry names default to `vertexMain`, `fragmentMain`, and `computeMain`. Rendering uses triangle lists with configurable `vertexCount` (default 3) and `instanceCount` (default 1). Output colors must use premultiplied alpha.

## Geographic grids and zoom controls

`data` accepts a `ShaderGrid` of scalar (`channels: 1`) or eastward/northward vector (`channels: 2`) float32 values. It is independent of the persistent simulation buffer. For example:

```tsx
import type { ShaderGrid } from 'react-native-enhanced-maps/shaders';

const wind: ShaderGrid = {
  width: 2,
  height: 2,
  bounds: [18, 54, 19, 55], // west, south, east, north, in degrees
  projection: 'equirectangular',
  channels: 2,
  units: 'm/s',
  interpolation: 'linear',
  values: [8, 2, 10, 3, 6, 1, 9, 2], // [east, north] at each grid node
  mask: [1, 1, 0, 1], // optional: 0 means missing, 1 means valid
};

<ShaderLayer
  id="wind"
  shaders={{ vertex: windVertex, fragment: windFragment, compute: windCompute }}
  simulation={{ byteLength: 2048 * 128, workgroups: [32] }}
  vertexCount={54}
  instanceCount={2048}
  data={wind}
  uniforms={(frame) => {
    'worklet';
    return [
      40 * 2 ** (12 - frame.zoom),
      0.1,
      1.2,
      0.45,
      0.02,
      0.36,
      0.95,
      0.95,
    ];
  }}
  minZoom={8}
  maxZoom={18}
/>;
```

Nodes are row-major from north-west to south-east, including the bounds' endpoints. `equirectangular` spaces rows uniformly in latitude; `mercator` spaces rows uniformly in Mercator y. Width or height 1 describes a constant field along that axis. Values must have exactly `width * height * channels` finite float32-compatible numbers, including finite placeholders for masked nodes. Bounds must have positive width/height and remain within ±85.0511287798066° latitude. West is in [-180, 180]; east is unwrapped and at most 360° greater than west. For dateline coverage use `[170, south, 190, north]`. Samples select the nearest repeated world copy. A full-world grid includes both longitude endpoints; provide matching values there for seam continuity.

`units` is required descriptive metadata; no implicit conversion occurs. Vector channels always mean east then north. In a scalar grid the sampled second component is zero. One grid is limited to 1,048,576 nodes (16 MiB GPU storage); replacement can briefly hold both old and new allocations. This API uses immutable ordinary numeric arrays. Memoize the grid and replace its object/arrays to upload a new field. Shape, bounds, projection, mask and value changes upload together at a rendering frame boundary without resetting particles or compiling new pipelines. Removing `data` produces invalid samples. Superseded packets are replaced; GPU buffers are disposed on replacement and teardown. Uploads occur only when data changes, on the rendering runtime, without per-frame data copies through the React/JS bridge.

All stages receive `mapSampleGrid(world)`, returning `{ value: vec2f, valid: f32 }`. It returns zero value and validity outside coverage, for absent data, or for missing samples. Linear interpolation is bilinear and invalidates a sample when any missing node has nonzero weight; it does not interpolate across holes. A small float32 boundary tolerance prevents exact edge nodes becoming invalid through rounding. Shader code controls how invalid samples affect output: fragment shaders should `discard` invalid samples to keep no-data areas transparent, and particle compute should retire or reseed invalid particles. Custom vertex shaders should pass world positions to the fragment stage for coverage clipping. The wind example demonstrates both. No automatic clipping is inserted into arbitrary shader entry points.

```wgsl
let sample = mapSampleGrid(world);
if (sample.valid < 0.5) { discard; } // fragment stage
// sample.value.xy holds east/north velocity, or .x holds a scalar.
```

Bindings 3 (read-only storage) and 4 (48-byte uniform metadata) are reserved; do not redeclare them. `mapGrid` exposes `bounds` (west/south/east/north), `shape` (width/height/channels/linear flag), and `options` (equirectangular flag/data-present flag/Mercator north/Mercator south). `mapGridUV(world)` returns geographic UV, which can fall outside [0,1]; call it only when data is present. `mapGridValues` stores one `vec4f(value.x, value.y, validity, 0)` per node. Prefer `mapSampleGrid` for ordinary sampling.

`minZoom` is inclusive; `maxZoom` is exclusive. Both accept finite fractional levels and are optional. Outside that range the layer publishes a transparent atlas once, then skips drawing, compute and uniform callbacks while freezing simulation time. It retains GPU resources and particle state for reentry; unlike `visible={false}`, it does not dispose the layer. Hiding takes effect on the next available output lease. Returning to the range resumes without accumulating the hidden interval.

The actual fractional camera zoom is available as WGSL `frame.zoom` and uniform-worklet `frame.zoom`. `frame.tileZoom` remains the atlas tile resolution, which may be lower. Use camera zoom for opacity fades, particle widths, speed or shader-controlled density. For example, `smoothstep(8.0, 10.0, frame.zoom)` fades particles in while zooming closer. The grid is sampled in float32; very small geographic extents and high zooms share the renderer's existing precision limitations. Tiled loading/caching and forecast-time interpolation remain future work.

## Persistent simulation and tile boundaries

Optional `shaders.compute` runs once per submitted frame, before all tile render passes. `simulation` provides `byteLength`, optional packed f32 `initialData`, and `workgroups`. The allocation is one layer-wide storage buffer at group 0 / binding 2: declare it read-write in compute and read-only in rendering. It is zero-initialized and bounded to 16 MiB. Custom storage layouts and deterministic initialization are the programmer's responsibility.

The wind example in `example/gpu/webgpuShader.ts` maintains positions and tail endpoints in that buffer and samples an input vector grid. Tile changes do not reset particles; every tile draws the same state with its own projection. A particle crossing an edge is drawn into both intersecting tile outputs. The example shifts both trail endpoints together at the antimeridian and retires/respawns particles outside a padded visible region. Its input grid is synthetic demonstration data, not an actual forecast. The example converts east/north metres per second to Mercator velocity and discards fragments over missing data.

The wind example uses 128 bytes per particle: a local head and tail, age/active state, a world origin, ten sampled trail positions and timing metadata. Origin-relative integration avoids rounding small forecast velocities away when updating float32 world positions. Nine tapered triangle quads draw each curved trail. Trail samples interpolate between updates, while tile-relative projection and analytic subpixel coverage reduce high-zoom flicker. Zero-length segments and invalid interpolated values are rejected to prevent speckle artifacts. Particle lifetimes are staggered, with soft fade-in/out and blue head-to-tail fading. Display uniforms are `[speedScale, sampleSpacingSeconds, halfWidthPixels, densityFraction, red, green, blue, opacity]`. Speed exaggeration and width follow actual camera zoom; physical input units are unchanged. Speed, trail and density controls update uniforms without replacing simulation. This is a Windy-inspired display treatment, not Windy's renderer or forecast data.

Each layer owns a triple-buffered 1024² atlas (12 MiB raw pixel storage), with at most sixteen 252² tile interiors and two-pixel gutters. Tile zoom is lowered to fit coverage and a margin within that budget. Very dense displays or low tile zoom can still enlarge these raster outputs; native-resolution vector rendering would be sharper. Four simultaneous layers can use 48 MiB of raw atlas storage. Rebuild native apps when updating from the 2048² transport. A completed atlas and its tile metadata are published atomically; native renderers retain output leases until their GPU reads finish. There is no CPU pixel readback and no per-frame RN bridge call. Completion currently waits on the GPU queue on the worklet runtime; native fence handoff is future optimization.

Simulation survives camera/tile changes and ordinary data/uniforms/pause/zoom-limit updates. Shader, allocation/draw configuration, placement, style reload and mount changes currently recreate the layer. Atlas swaps retain the old front until the replacement is complete, but do not crossfade different resolutions. Large camera jumps can briefly expose areas until the next atlas is produced. This is bounded rendering, not a weather-data tile cache or texture-streaming API.

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
