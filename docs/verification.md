# Initial implementation verification — 2026-10-19

This is evidence for the first development slice, not completion of the feasibility
milestone or v1. Work is on `feat/native-maps-feasibility`.

## Passed

- TypeScript declaration builds, public positive/negative type cases, and example typecheck.
- Seven Node contract checks: provider defaults/rejection, camera validation,
  stale revision invalidation, consumer CLI autolinking, and recoverable error classification.
- React Native Codegen generation for both platforms.
- Production Metro bundles for iOS and Android.
- Both npm tarballs pack and install into a declaration consumer, with native source
  inclusion and generated native-build-file exclusion checks.
- Xcode simulator Debug build with MapKit and WebGPU dependencies linked.
- Gradle `:app:assembleDebug --no-daemon -PreactNativeArchitectures=arm64-v8a`,
  including the Google adapter and WebGPU native compilation.
- iPhone 17 Pro / iOS 26.1 simulator: MapKit loaded and reported ready; Move changed
  camera zoom/heading; Remount and Unmount/Mount returned to ready. Selecting Google
  in the Apple-only build produced the expected structured unavailable-provider error.

The recovery regression test verifies error classification; the mounted component
readiness conditional was reviewed. A real network-failure/recovery device scenario
has not been run.

Initial packed sizes after builds: core 13,635 bytes, TypeGPU contracts 1,601 bytes.
These exclude transitive peers, provider SDKs, and native application binaries.
They are not final release size budgets. The GPU runtime includes Dawn.

## Not verified / still to implement

- Release native builds, physical-device performance, memory stress, and leak tests.
- Exact MapKit camera zoom/projection parity, frame-level synchronization, and animation timing.
- A standalone TurboModule: current operations are view commands; add a module
  when a non-view operation requires one.
- Source/layer rendering, clustering, detailed gesture recognition, and full compatibility inventory.
- Actual TypeGPU shader rendering and geographic alignment. Companion exports contracts only.
- Automated device scenario runner and sensitive-data-safe structured native diagnostics.
- Clean native consumers installed from tarballs, Expo plugin and Expo builds, and accessibility coverage.

## Local artifacts

Ignored `artifacts/verification/` contains `summary.json`, native build logs, contract
and package-check output, plus screenshots of map readiness, camera movement, and
optional-provider errors. These are session artifacts, not an automated scenario
runner. `artifacts/bundles/` and `artifacts/packages/` contain built bundles/tarballs.

Read `docs/development.md` for repeatable commands. Use the example's Metro port
8088; do not terminate a different project's server on 8081. Simulator screenshots
and debug build success are not release performance evidence.

## Google providers and unified camera delivery — 2026-10-19

Google tiles and readiness were verified on Pixel 9a Android 16/API 36 emulator
and iPhone 17 Pro iOS 26.1 simulator. Both native Debug builds passed with Google
iOS enabled. Google iOS Move and Remount also returned expected camera/readiness.

For a 500 ms drag with the default 100 ms interval, Android Google and iOS Google
each delivered six change events; MapKit delivered five. Each delivered exactly one
idle event. With the change callback removed, all three delivered zero change
events and one idle event. Counts include the final change snapshot; exact live
sample counts depend on SDK callback timing. MapKit gesture provenance remains unknown.

Before Android gating the recorded drag delivered 17 changes; afterward the same
recorded flow delivered seven. A debug React profile showed fewer commits (13 to 7)
and fiber renders (312 to 168); recording durations differed, so total CPU time is
not comparable. This is event/render evidence, not an FPS or release benchmark.
Native Java/C++ gate regression tests cover throttling, disabled subscribers,
final delivery, movement boundaries, and reset. The example exposes development-only
bounded timestamp diagnostics and a Live toggle for repeating these checks.

Ignored `artifacts/verification/google-provider/` contains structured counts,
redacted build/check logs, and representative screenshots. The reusable Android
pan is `.argent/flows/google-camera-pan.yaml`.

## TypeGPU geographic texture prototype — 2026-10-19

TypeGPU executed an offscreen triangle shader with a typed RGBA uniform on the
Android emulator and iOS simulator. Native Google ground overlays and an Apple
MKOverlayRenderer displayed its transparent RGBA texture at geographic bounds.
All three displayed blue and replacement pink textures during rotation, tilt,
zoom and drag. Google Android remount retained the intended texture, and removing
the raster removed its image. Live camera changes stayed disabled: the scripted
zoom 13 / heading 90 / pitch 45 path kept change counts at zero and advanced idle
from 1 to 2 on all three providers. This is a settled visual check, not a quantified
alignment or frame-latency measurement.

Both native Debug builds passed with the new adapters. Production Metro bundles,
TypeScript/Codegen/package checks and 17 contract checks pass, including payload
limits, row-padding removal, shader vertex resolution, asynchronous GPU validation
errors and the example's TypeGPU Babel compatibility workaround.

Read `docs/shader-raster-scenario.md` for repeatable UI and CDP controls. Ignored
`artifacts/verification/shader-raster/` contains screenshots, structured snapshots
and build/check logs. The shader path uses no new runtime npm dependencies;
two Babel transforms are example-only development dependencies.

This is one-shot shader baking with GPU-to-CPU readback and native image upload.
Live shader animation, native WebGPU camera transport, portable projection/depth,
style-layer insertion and picking are not implemented. Release physical-device
frame/memory measurements, pixel-diff alignment bounds and lifecycle stress remain
pending. The earlier claim that the companion contains contracts only is superseded
by this experiment; it still does not provide the planned live shader layer.
