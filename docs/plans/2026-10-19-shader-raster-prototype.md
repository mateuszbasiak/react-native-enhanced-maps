# Geographic shader texture prototype

**Goal:** Execute a TypeGPU shader and anchor its output on Google Android/iOS and MapKit, without forwarding camera frames to JS.

**Architecture:** An optional companion renders a bounded RGBA texture offscreen. Core accepts an experimental immutable geographic raster with north/south/east/west bounds. Native SDK ground overlays (Google) and an MKOverlayRenderer (Apple) own projection and camera synchronization. No new runtime dependency. Transparent ground content does not intercept touches.

This is the first feasibility experiment in the approved geographic overlay prototype. Alternatives are a sibling WebGPU canvas with native projection transport (requires new native/JSI synchronization) or direct SDK render-pass injection (no common public hook established). Raster baking tests static shader output and native projection first; it cannot establish live GPU animation, depth/3D occlusion, arbitrary map-style ordering, or large datasets. No screen-space matrix is inferred from camera zoom.

## Steps

1. Add failing contract tests for raster limits, bounds, bytes and companion shader output packing. Reject antimeridian/polar bounds explicitly in this experiment.
2. Implement typed experimental raster props and strict bounded validation. Encode RGBA only on raster replacement; no per-camera JS work.
3. Add native image decoding and replacement/removal on all providers, independently of camera event subscriptions. Native validation bounds allocation. Clear retained images/overlays on disposal.
4. Implement TypeGPU triangle pipeline with typed color uniform, offscreen RGBA8 rendering, aligned GPU readback, resource cleanup and abort handling. Expose no animation-loop promise.
5. Add example toggle, uniform color change and deterministic tilted camera path, with shader status. Preserve old lifecycle/event controls.
6. Run contracts/typechecks/Codegen/package checks, native builds and device checks; save evidence and document limitations.

## Acceptance

Visible transparent triangle at the same geographic bounds on all providers. Camera movement works with Live off. Texture replacement/removal and remount do not retain old content. GPU errors surface visibly. Automated tests reject malformed/oversized payloads. Release physical-device frame/memory benchmarking and animated shader integration remain separate acceptance gates.
