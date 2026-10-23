> Historical prototype record. Apple/Google experiments were removed in the package-owned MapLibre migration. See the root README and package source for the current API; earlier verification does not verify the migrated native implementation.

# Android marker comparison

Open **Marker benchmark** in the example app. Choose baseline, bitmap, advanced, or advanced-native; select 100, 500, 1,000, or 5,000. Markers load automatically after map readiness; no camera animation is required to inspect them. Run camera benchmark waits one second, then samples eight seconds of scripted camera movements. Stop or any manual camera gesture cancels pending camera steps. Repeated benchmark runs reuse the prepared markers. Tap and long-press individual markers after setup to inspect child event counters. Mode/count changes remount the map.

- Bitmap: captures the first RN child once and shares that image across identical markers. RN children remain mounted but invisible. This deliberately includes RN mounting overhead; a production cached renderer could avoid mounting duplicate children entirely.
- Advanced: passes each actual RN child view into Google's iconView. DEMO_MAP_ID is used only for the experimental host. Capability failure is reported explicitly. RN/Fabric touch routing after SDK reparenting is an experimental question, not a supported guarantee.
- Advanced-native: diagnostic control using plain Android TextViews with the same SDK iconView path. RN children remain mounted but invisible to hold mounting overhead comparable; child press counters do not apply. This isolates the visible RN subtree from the map-following path.
- Baseline: map with zero marker children.

Content is currently one repeated 48×36 Boat button. Coordinates are deterministic and prefix stable. No culling, clustering, collision avoidance, unique content, animated content, or Gesture Handler dependency is included. Press and long-press do not establish compatibility with arbitrary child pan/pinch gestures.

## Measurements

On-screen JSON reports native setup time (excludes React mount), Choreographer frame interval median/p95, number of intervals above 33.34 ms, sample count and native marker clicks. Frame intervals measure UI-thread scheduling, not GPU frame presentation. Setup completion is not proof every SDK marker has rendered. Native clicks and RN child presses are distinct.

Use a physical Android device with a release build for decisions. Debug/emulator results are functional smoke checks only. Run baseline and each count/mode three times, rotate order, keep device conditions fixed, and retain raw reports. Collect total PSS with `adb shell dumpsys meminfo com.enhancedmapsexample` (confirm application ID locally); use Perfetto/FrameTimeline for actual presented frames. Measure cold mount separately; native setup excludes it. Interactive UI report updates can perturb timing, so test presses outside timed runs.

Build debug with `npm run build:android`; launch through `npm run example:android` with existing Metro on port 8088. For release use the example's Android Gradle `:app:assembleRelease` task; do not interpret debug results as throughput limits.

## Evidence

TypeScript and codegen passed. Contract suite: 30 tests passed, including deterministic workload bounds and count validation. Android arm64 debug APK built and installed successfully. All three renderers completed camera workloads at 100 and 1,000 markers on the Pixel_9a API 36 emulator. Live overlay and advanced iconView each delivered a nested RN press at 100 markers; advanced iconView additionally delivered a nested RN long-press at 1,000. Advanced presses also triggered the SDK marker-click callback. Bitmap taps triggered only SDK marker clicks. These checks establish Pressable behavior only, not arbitrary Gesture Handler support.

Raw single-run reports: `marker-prototype-smoke.json`. The automated sweep briefly reused a stale overlay report during the advanced transition; that duplicate was discarded and advanced 1,000 was run separately. Native setup excludes React mounting and SDK drawing completion. The empty-map baseline also had severe stalls, so these emulator frame intervals cannot establish a throughput winner. Advanced 1,000 native setup took approximately 15 seconds in this environment. The 5,000 setting is available but was not exercised. Physical-device release profiling, memory comparisons, complex/unique children, and child pan/pinch tests remain outstanding.

## Current scope and camera alignment

The live React overlay mode was removed at the user's request after poor interaction behavior. The earlier JSON retains historical overlay samples; it does not describe a currently available mode.

Advanced markers have fixed geographic positions assigned once at creation. The package does not recompute or throttle their position during camera changes. Google documents iconView markers as views on a separate layer above the core map, whereas bitmap markers are drawn by the core map: https://developers.google.com/maps/documentation/android-sdk/advanced-markers/collision-behavior . Position lag during movement must be distinguished from JavaScript camera-event throttling: intermediate JS camera events are disabled in this harness. A settled camera event is enabled only for development diagnostics. Perfect frame synchronization of SDK view markers has not been established.

The advanced-native control compiles in the Android arm64 build, but a reliable movement comparison against RN children has not yet been captured. It must not be cited as proof that the SDK is solely responsible for the reported lag. The lag remains unresolved. The source-level finding is only that this package assigns the advanced marker coordinate once and leaves subsequent camera tracking to the SDK.
