# React Native WebGPU as the map shader runtime

Investigation date: 2026-10-21. Scope: current upstream documentation and the
installed `react-native-webgpu` 0.17.0 / Dawn 157.0.0 sources. This is a source
and architecture investigation, not a measured MapLibre/WebGPU integration.
No simulator/device interaction was performed for this investigation.

## Finding

React Native WebGPU is a credible common runtime for programmer-authored map
layers. It provides the same WGSL/WebGPU resource API on both platforms and
supports the native memory and synchronization primitives needed for an adapter.
It could replace our proposed WGSL-to-Metal/GLES build toolchain. TypeGPU can
remain optional for typed shader authoring.

Adoption is conditional: a writable shared-output pool, native MapLibre
compositors and frame scheduler still need implementation and device evidence.
The existing Metal shader spike proves none of that handoff. Do not mark
cross-platform GPU support as implemented or production-performant yet.

## What is established

- Standard WebGPU render/compute pipelines and WGSL shader modules are provided
  through Dawn. The installed GPU adapter selects Metal on Apple and Vulkan on
  Android (`cpp/rnwgpu/api/GPU.cpp:28`).
- Native extensions expose `GPUDevice.importSharedTextureMemory`,
  `GPUSharedTextureMemory.createTexture`, `beginAccess` and `endAccess`.
  The implementations import IOSurface on Apple and AHardwareBuffer on Android
  (`cpp/rnwgpu/api/GPUDevice.cpp:324`). Imported color textures can be writable
  when the surface's format/usage and adapter support allow it; sample-only
  video/external-texture import is not itself an output target.
- Shared fences can be imported/exported. The installed fence exporter uses
  MTLSharedEvent on Apple and duplicates sync file descriptors on Android;
  caller ownership/cleanup matters (`cpp/rnwgpu/api/GPUSharedFence.cpp`).
- Worklets can encode and submit commands outside the main React JS runtime.
  GPU HostObjects have custom serialization support. One runtime owns each
  encoder; coarse device locking does not make unrestricted concurrent use free.
- Native-surface features are enabled only when the adapter supports them.
  Successful `requestDevice()` is not proof of shared-output support.
- `importDevice()` requires a compatible Dawn WGPUDevice and shared Dawn instance.
  It cannot wrap MapLibre's plain Metal device or OpenGL context.
- The installed `GPUOffscreenCanvas.getImageData()` explicitly copies a texture
  to a mapped CPU buffer. That path does not meet the live-layer requirement.
- The installed runtime's Android minimum is 26; core maps declares 24, and the
  example already uses 26. Compatibility and consumer documentation need a
  conscious dependency/version policy.
- Worklets is not installed in this workspace. Its optional serialization path
  and a dedicated scheduling runtime have not been exercised here.

## Proposed integration

1. A map-owned native adapter allocates a bounded pool of writable shareable
   color buffers, with GPU color-output and sampling usage.
2. Import each buffer into the package-owned WebGPU device once. Keep imports,
   texture views, pipelines, bind groups and simulation buffers alive across frames.
3. A dedicated GPU worklet encodes programmer-supplied WebGPU compute/render
   passes. Its final pass writes to an acquired output texture. The package
   submits, ends the shared-memory access, and publishes its completion fence.
4. MapLibre's native custom layer samples the shared output at its chosen style
   position. Native projection places the output over its geographic bounds.
5. Track native sampling completion before releasing a buffer for another write.
   Retain the last completed image when the producer is late. Never overwrite a
   displayed/in-flight buffer or build an unbounded queue.

Apple: IOSurface-backed output can be imported by Dawn and bound as a Metal
texture for the existing MLNCustomStyleLayer compositor. Fence waits must be
encoded before the active render pass, not inserted arbitrarily into its encoder.

Android: WebGPU/Vulkan and MapLibre/OpenGL must share an AHardwareBuffer through
EGLImage. Android's NDK documents this mechanism; the adapter must verify the
actual driver's allocation, render usage, EGL extensions and native-fence path.
The pinned MapLibre `CustomLayer` requires a C++ host pointer, so JNI/C++ host
integration remains necessary. A generic Java/Kotlin Canvas overlay will not do.

No main-thread pixel readback is required by this design. This does not prove
zero-copy behavior or throughput for every format/driver; measure actual imports,
GPU traffic and implicit conversions. It introduces an offscreen color pass and
native texture sampling, unlike direct shading into the map's render pass.

## Projection and scope

Start with geographic 2D outputs: the shader renders within a bounded Mercator
region and MapLibre projects that texture at draw time. Ordinary camera movement
then needs no JS projection feed. Screen-space effects that depend on an exact
map camera revision require additional synchronization and are not established
by this path. Terrain, shared depth and arbitrary 3D remain separate contracts.
Native iOS annotation markers remain above the map surface.

This architecture accommodates compute-driven particles inside the WebGPU
renderer, but simulations, allocation limits and deterministic time stepping
still belong to the layer contract. GPU execution alone does not guarantee that
future command submissions continue when the main JS thread is busy.

## Performance acceptance before enforcing it

The risky experiment is output sharing, especially Vulkan-to-OpenGL on Android;
start there rather than building a broad public API first.

Use identical WGSL and input fixtures on iOS/Android. Prove writable shared output,
fenced producer/consumer reuse, below-label ordering, projection under camera
movement, alpha/color/texture orientation, replacement and cleanup. Test 512,
1024 and 2048 square outputs; these are experiment sizes, not accepted budgets.

Compare map-only, native custom shader, and WebGPU shared-output paths. Measure
CPU encode/submit time, producer GPU time, native composition GPU time, p95/p99
map frame time, dropped frames, frame age, fence delay, allocation churn, memory,
GPU dependency size and build costs. Repeat under a three-second JS stall and
native camera gestures. Choose physical reference devices and numeric budgets
before calling the result acceptable. An emulator or successful build is not
performance evidence.

Stress resize, hidden/background transitions, source edits, device loss,
style replacement, multiple maps and disposal. Verify no old GPU jobs publish
into a new map/style generation and no file descriptors or native handles leak.
If sharing is unavailable, report unsupported while retaining the ordinary map;
do not silently use CPU readback or a software adapter.

## Recommendation

Use React Native WebGPU as the candidate required runtime for the optional GPU
layer entry point. Keep core map use independent of it. Prefer standard WebGPU
resources and optional TypeGPU authoring over a second shader/compute framework.
Require a worklet/native scheduling path for the JS-contention target.

Do not finalize the dependency requirement on the strength of documentation alone.
Passing the shared-output and performance experiment on both platforms is the
condition for enforcement. See the proposed [API contract](shader-layer-api.md).

## Primary sources

- [API overview](https://wcandillon.github.io/react-native-webgpu/api).
- [Native texture and fence extensions](https://wcandillon.github.io/react-native-webgpu/api/gpu-device-extensions).
- [Native APIs and device-import restrictions](https://wcandillon.github.io/react-native-webgpu/docs/getting-started/native-api).
- [Worklets and threading](https://wcandillon.github.io/react-native-webgpu/docs/integrations/worklets).
- [TypeGPU integration](https://wcandillon.github.io/react-native-webgpu/docs/integrations/typegpu).
- [Android AHardwareBuffer/EGL/Vulkan interoperability](https://developer.android.com/ndk/reference/group/a-hardware-buffer).
- [Apple IOSurface-backed Metal textures](<https://developer.apple.com/documentation/metal/mtldevice/maketexture(descriptor:iosurface:plane:)>).

Installed source paths above are relative to `node_modules/react-native-webgpu`.
Upstream documentation can describe newer behavior; lock the tested dependency
and native artifact versions when accepting an implementation.

## Follow-up prototype

The subsequent [shared-output spike](webgpu-shared-output-prototype.md) visibly
renders the same WGSL on both available simulator backends. Android required
explicit software-adapter diagnostic mode. It establishes initial writable
interop but not hardware Android performance, production synchronization or
worklet scheduling. The conditional adoption recommendation remains in place.
