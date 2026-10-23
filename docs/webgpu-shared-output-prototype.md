# WebGPU shared-output prototype

Historical spike record: the renderer has moved to [ShaderLayer](shader-layer.md),
with a world tile atlas, shared compute state and worklet submission. Fixed Gdańsk
bounds and the main-JS loop described below apply to the original spike.

This Debug example renders one JS-owned WGSL program on iOS and Android through
`react-native-webgpu`, then samples its output inside MapLibre's native layer
stack. It is separate from the earlier iOS-only Metal-source experiment.

## Run it

Use the existing Metro server (`npm start`, port 8088), then build/install the
example with `npm run example:ios` or `npm run example:android`. Native changes
require rebuilding. In the app select **Open WebGPU prototype**.

- Waves/Radar/Checkerboard switches a WGSL uniform; Amber/Blue changes color.
- Below labels/Above labels moves the native compositor within the style.
- Tilt / rotate exercises geographic placement. Flat returns north-up.
- Reload style and Remount exercise replacement/lifetime.
- Pause freezes simulation time; this spike still produces identical frames.
- Block JS 3s demonstrates the current scheduling limitation: animation freezes.
- Software GPUs are rejected by default. **Allow software GPU (diagnostic only)**
  permits an explicitly labeled interoperability check; it is not a performance
  fallback or hardware acceptance.

Edit `example/gpu/webgpuShader.ts` to change the programmer-owned WGSL program.
Both platforms import that exact module. Metro delivers edits and the example
reinitializes its renderer; production pipeline-preserving hot replacement is
not implemented. Hook-structure edits during development can require a full
reload. The native code contains only a texture compositor, not copies of the
effect algorithm.

## Actual path

A Debug native module allocates three fixed 512×512 output surfaces. On iOS these
are BGRA IOSurfaces; on Android RGBA AHardwareBuffers allocated for GPU color
output and sampling. JS imports each once with `importSharedTextureMemory` and
creates a WebGPU render target over it. The WGSL pipeline uses the returned
format; its shader code is identical across platforms.

Each tick acquires a slot that is neither front nor still being read, begins
WebGPU access, encodes the full-screen effect, submits and ends access. It awaits
`queue.onSubmittedWorkDone()` asynchronously before publishing the slot. No
texture-to-buffer copy, pixel mapping, base64 or CPU pixel upload occurs.

MapLibre samples the surface through an MLNCustomStyleLayer/Metal texture on iOS
and a CustomLayerHost/EGLImage/GLES texture on Android. A geographic quad uses the
SDK projection matrix. Native sampling completion retains the slot: Metal command
buffer completion on iOS, GLES fence polling on Android. The front remains
pinned between draws; no producer may overwrite it. Pool/host references outlive
in-flight native reads. Removal retires the pool, and JS releases imports after
its GPU submissions finish. At most four prototype pools may be live.

Android's custom host ABI headers are vendored from the exact `android-v13.6.1`
tag with its BSD license. This is not an engine fork. The AHardwareBuffer API is
resolved dynamically so core's declared Android 24 minimum is unchanged; this
prototype and RN WebGPU require Android 26+.

## What passed — 2026-10-21

- `npm run check`: 72 tests, type/quality checks, Codegen and packed consumers.
  The added C++ state-machine regression checks front pinning, active leases,
  outstanding readers, backpressure, closure and duplicate publication rejection.
- iOS Debug simulator build and Android ARM64 Debug build succeeded.
- Production Metro bundles for both platforms succeeded.
- The iPhone 17 Pro simulator (iOS 26.1) visibly animated waves/radar over the map,
  with a native marker above. Above/below-symbol placement controls, tilt/45-degree
  rotation, style reload and map remount continued rendering without a displayed
  native error. This is visual smoke evidence, not a numeric alignment matrix.
- The Pixel_9a Android 36 emulator reported a Mesa software Vulkan adapter with
  shared AHardwareBuffer/fence features. Default rejection was verified. Explicit
  software diagnostic mode then visibly rendered the same waves/radar program
  through MapLibre's OpenGL compositor. Above/below controls, tilt/rotation,
  style reload and remount continued rendering with no displayed native error.
  Hardware Android performance is unverified.
- Normal smoke runs produced hundreds/thousands of frames with three output
  slots. The UI showed approximately 17 ms on iOS and 28–33 ms in Android software
  mode for the **submit-to-publish wall interval including JS, bridge and GPU
  completion waiting**. These are neither GPU shader timings nor display FPS,
  percentiles, release results or accepted budgets.
- Code review identified and fixed two Android exceptional paths: fence creation
  failure now completes submitted reads before reuse; context loss destroys
  EGLImages using their allocation display. Focused re-review found no further
  issue with those fixes. This does not establish leak-free stress behavior.

Local raw screenshots/build logs are retained under `artifacts/webgpu-prototype`
when available. The written commands, fixture and limits are versioned; ignored
artifacts may not exist on another checkout.

## Deliberate limits and decision

The interoperability experiment succeeds on the available simulator backends:
WebGPU output can appear within MapLibre's style stack on both without CPU pixel
readback. It is now reasonable to continue with RN WebGPU as the shader runtime
candidate, with optional TypeGPU authoring.

This is not the proposed public GpuLayer API. It uses an internal Debug command
and bridge, a fixed Gdansk quad, one producer, fixed output resolution, no textures
as application input and no simulation buffers beyond a uniform. Native markers
have their existing platform ordering. Error handling, device loss, background
stress, repeated reloads, production compilation/caching and physical devices
still need acceptance work.

Main-JS encoding and completion-mediated producer handoff are intentionally
conservative and add latency. They must be replaced/measured with dedicated
worklet scheduling and a native-fence handoff before evaluating the performance
contract. This output path adds an offscreen pass and texture sampling; it does
not prove equivalent cost to a shader directly in MapLibre's render pass.

The public contract and performance gates remain proposed/open. See
[API contract](shader-layer-api.md) and
[investigation](react-native-webgpu-investigation.md).
