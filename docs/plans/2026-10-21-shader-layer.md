# ShaderLayer implementation plan

**Goal:** Move the agreed WebGPU shared-texture experiment into a reusable MapView child on iOS and Android, retaining main-JS scheduling until the worklet follow-up.

**Architecture:** ShaderLayer owns WGSL compilation, two uniform bindings, a bounded shared-output pool and cleanup. MapView supplies readiness and revision-scoped acknowledged commands through a private context. Native hosts composite independent named layers at supplied geographic bounds and placement. The WebGPU runtime is an optional peer loaded only when a shader layer mounts. This first API supports a fullscreen triangle into a fixed 512² output, not arbitrary geometry or compute pipelines.

**Contract:** `id`, `shaders` (fragment WGSL and optional vertex WGSL/entry names), `bounds`, optional packed float `uniforms` or frame callback, `beforeId` or above/below-label placement, `paused`, `visible`, explicit diagnostic software-adapter opt-in, `onError` and `onReady`. Binding 0 is four f32 values: time, delta, width, height. Binding 1 is user-packed uniform data, padded to 16 bytes. Shader outputs use premultiplied alpha.

1. Add failing validation and query-acknowledgment tests; validate IDs, bounds, shaders and bounded finite uniform data.
2. Implement ShaderLayer resource lifecycle and map context, hot shader rebuilds, input updates and cleanup. Keep shader initialization serialized per component to avoid accumulating pools during edits.
3. Generalize native commands to named layers, pool ownership checks, geographic bounds and exact beforeId insertion. Make WebGPU transport available in release as well as Debug; retain the separate old Metal experiment Debug-only.
4. Replace example-owned renderer with public MapView/ShaderLayer/Marker usage and shader/uniform controls.
5. Run targeted contracts, type checks, full checks, both JS bundles and native builds. Smoke-test both platforms, shader edits, placement and remount. Request code review and fix actionable findings.
6. Document API and remaining limitations: JS scheduling, completion-mediated synchronization, fixed resolution, flat geographic rectangle, no antimeridian crossing, device-loss errors rather than automatic recovery, hardware performance acceptance pending.
