# Custom GPU layer feasibility prototype

Goal: decide whether map-integrated custom shaders warrant further work.

Approved scope: a quick prototype of an animated geographic effect inserted below
or above labels. No stable public API, renderer fork, or production GPU claim.

Implementation:

1. Add an iOS Debug-only Metal custom style layer using the installed SDK encoder.
2. Drive a geographic quad with the SDK projection matrix, and animate a procedural
   wave/flow fragment shader. Keep the shader and rendering in the native pass.
3. Add an example-only screen using the existing internal Fabric query command:
   below/above labels, pause, remove, style reload, remount, camera tilt/rotation,
   native marker and deliberate JS blocking. Do not expand the public MapView API.
4. Build and run on the available simulator; inspect ordering and geographic
   anchors, animation, JS contention and lifecycle. Record exact limits.
5. Inspect Android's pinned CustomLayer ABI and TypeGPU/WebGPU integration gap.
   An iOS native Metal result does not establish Android or TypeGPU support.

Acceptance is feasibility evidence, not feature completion. All GPU release gates
remain open. No per-frame GPU readback or JS camera transport is allowed.
