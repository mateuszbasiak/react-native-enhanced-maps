# Custom GPU layer feasibility spike

This is an iOS Debug-only experiment, not a public API or TypeGPU integration.
Open **GPU prototype** in the example. Android explicitly shows unsupported.

## What programmers control from JS

`example/gpu/effects.ts` owns the complete fragment effect programs. Waves, radar
and checkerboard are independent Metal functions, not native animation presets.
Edit a function or add another with this prototype signature:

```cpp
float4 mapEffect(float2 uv, float time, float4 color, float4 parameters)
```

Return premultiplied RGBA. UV spans the fixed geographic quad south-to-north;
time is advanced natively. The JS example sends shader source and uniform values
through an internal Debug query command. Source changes compile a new pipeline;
uniform changes reuse it. A failed shader compilation retains the previous
pipeline and appears in Stats. No public MapView API was added.

The example exposes placement below the first style symbol layer or at the top
of the style, three effect programs, color/opacity/speed, a four-float parameter
vector (the demo exposes its first component), pause/remove, tilted camera,
style reload, remount and a deliberate three-second JS stall.

## Rendering and performance boundaries

The layer draws directly into the MapLibre-provided Metal encoder with the SDK
projection matrix. Four corners are projected in double precision, preserving
homogeneous w for perspective interpolation. Pixel effects execute on the GPU;
there is no per-frame CPU pixel readback or JS camera feed. Native ticks request
30 frames/second for this demonstration; that is a target, not a measured result.

The quad is currently fixed over Gdansk. Data textures, arbitrary geometry,
compute passes, particle state, generic uniform reflection and multiple custom
layers are not implemented. Native iOS annotation markers remain above the map
render surface. Layer placement does not establish arbitrary marker interleaving.
The Stats anchor error compares CPU clip projection with SDK corner projection;
it is not a measured screenshot alignment result.

Shader compilation currently happens in the draw callback. A production design
must move compilation/preparation off the frame-critical path, define caching
and ownership, and measure shader cost and resource limits. Pixel overdraw and
shader complexity still matter even with direct rendering.

## Evidence — 2026-10-21

- `npm run check` passed: 71 tests, types, lint/format, Codegen and packed consumers.
- `npm run build:ios` passed after JS-source and uniform support was added.
- All three exact assembled effect sources compiled into Metal libraries and
  render pipelines on the Mac GPU using a temporary Swift/Metal harness. This
  is shader validation, not iOS MapLibre runtime or performance validation.
- The initial native prototype build was installed on the booted iPhone simulator.
  Simulator interaction stopped when the user reported another agent using it.
  Later JS-source/uniform builds have not been installed or runtime-verified by
  this agent. The user reported that the initial prototype looked nice.
- Android's installed 13.6.1 `CustomLayer` constructor takes `(String, long)`:
  a native C++ host pointer is required. No Android shader backend was built.

No frame-time, physical-device, geographic alignment, JS-stall or lifecycle
acceptance claim is made from these builds. GPU release gates remain open.

## Authoring choices remain open

Direct Metal on iOS and GLES on the pinned Android renderer minimize integration
layers but require backend programs or a build-time shader compiler. GLSL through
SPIR-V/SPIRV-Cross or Slang are candidates to investigate, not adopted tooling.

TypeGPU targets WebGPU. The installed RN WebGPU runtime has shared native texture
and fence facilities, but its WGPU-device import cannot directly wrap MapLibre's
Metal device. Sharing output would require explicit resource ownership, fences
and frame scheduling. It is not proven impossible, and it has not been measured.

Skia supports JS-authored SkSL effects, but a separate Skia Canvas cannot satisfy
map-style ordering. A native integration/shared texture adapter still needs
validation. There is no measured basis here for claiming Skia shaders are slow.

## Required portability contract — user direction, 2026-10-21

Programmers must author an effect once and use the same JS interface on iOS and
Android. Hand-maintained Metal/GLES copies do not meet the requirement. The
current Metal-only spike does not satisfy this contract.

Recommended next feasibility experiment: author one WGSL effect, use a pinned
build-time compiler such as Naga to emit Metal and GLSL ES compatible with the
installed MapLibre backends, and render those outputs inside each native custom
layer. Generated backend sources are build artifacts, not application-authored
programs. This uses WGSL as a portable shader language without requiring a WebGPU
renderer. TypeGPU could later be an optional authoring frontend that emits WGSL.
Naga is a candidate supported by its documented WGSL input and Metal/GLSL ES
outputs; it is not installed or verified in this repository yet.

The initial fragment-effect experiment must establish uniform layout, geographic
UVs, time/speed/pause semantics, premultiplied alpha, texture origin and color
space, projection and layer ordering on both hosts. Reject features outside the
shared backend subset at build time; do not silently approximate them. Shared
source does not promise pixel-identical floating-point output. Validate known
fixtures on each backend and measure frame time, update cost and JS contention.

Do not infer compute/particle-simulation support from a fragment-effect success.
The current Android OpenGL backend's supported stages/resources remain a separate
acceptance question. No shader authoring/compiler choice is finalized by this
recommendation.

## Follow-up: React Native WebGPU runtime investigation

The subsequent [runtime investigation](react-native-webgpu-investigation.md)
found documented shared-output and worklet primitives. React Native WebGPU is
now the candidate to test before investing in a custom cross-compilation tool.
Its MapLibre bridge and performance are not yet verified. A [proposed API
contract](shader-layer-api.md) describes this conditional runtime direction.
