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

`visible={false}` releases resources. Backgrounding skips output production and freezes time until active again. `onReady` currently indicates pipeline initialization and native attachment; `onError` reports compilation, runtime, native import or device-loss errors. A failed layer is detached without making the ordinary map unavailable. Correcting shader/configuration props retries initialization; automatic device-loss recovery is not implemented. `allowSoftwareAdapter` is an explicit diagnostic opt-in, never hardware performance acceptance.

The host capability report marks shaders `unvalidated`. Release-device throughput, energy use, high-pitch/horizon coverage, high-zoom precision, resolution-transition quality and full lifecycle stress remain open validation gates.
