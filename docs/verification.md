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

- Google iOS enabled compilation and Google runtime behavior on either platform.
  No Google keys were configured in the checked environment variables; Google iOS
  is disabled in the default Pods configuration.
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
