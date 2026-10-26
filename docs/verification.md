> Historical prototype record. Apple/Google experiments were removed in the package-owned MapLibre migration. See the root README and package source for the current API; earlier verification does not verify the migrated native implementation.

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

## 2026-10-19: initial native source/layer API

Implemented Mapbox-like `GeoJSONSource`, `LineLayer` and `FillLayer` composition.
Shared sources, explicit source references, immutable revisions, source/style
serialization separation, visibility, declaration order and removal are covered
by [the contract](layers.md) and [scenario](layer-scenario.md).

Validation: `npm run check` passed (28 contract tests, public type checks,
Codegen and packed declaration consumer). Production bundles passed on both
platforms. ARM64 Debug native builds passed for Google Android and the Google-enabled
iOS workspace (including MapKit). A subsequent package check after deleting stale
particle-prototype build outputs passed: core 34957 packed bytes; TypeGPU 7751.

Debug runtime evidence:

- iPhone 17 Pro simulator / iOS 26.1 / MapKit: shared source rendered as fill plus
  two line strokes; polygon hole visible; pink style and revision-2 replacement
  rendered; visibility cleared shapes. A heading-90/pitch-45 camera move with Live
  off left changes at 3 and advanced idle from 2 to 3 while shapes stayed attached.
- Google Maps iOS on that simulator: polygon hole, pink style, revision-2 route,
  tilt and visibility checked. Source removal/re-addition worked; reversing the
  line layers covered the inner pink stroke with the wide dark stroke. With Live
  off, changes stayed at 5 while idle advanced from 3 to 4.
- Pixel 9a ARM64 emulator / Android API 36 / Google Maps: equivalent fill/hole and
  two-stroke route visible. Style/revision replacement, visibility and source
  removal/re-addition checked. Reordering covered the inner stroke. Changes stayed
  at 2 while idle advanced from 1 to 2 during the tilted camera move with Live off.

Local screenshots are in ignored `artifacts/layers/`; they are not portable
release artifacts. These checks establish debug visual feasibility, not numeric
projection parity, memory-leak freedom, performance budgets or full lifecycle
coverage. Native source parsing/SDK mutations currently run on the UI thread.
Expressions, feature picking, source patches, clustering, other layer kinds,
world-edge fixtures and GPU rendering remain separate work.

## Shared native component renderer — 2026-10-19

Replaced the public source/layer API with Polyline, Polygon, Heatmap and
ParticleLayer descriptors and shared native CPU drawing surfaces. `zIndex` spans
these four types; provider basemap content, SDK markers and experimental raster
remain outside this ordering. Historical source/layer checks above describe the
superseded implementation.

Validation: `npm run check` passed35 tests, type checks, native codegen and packed
consumer declaration resolution. Both Metro bundles and pod installation passed.
ARM64 Android debug and iOS simulator builds passed. A read-only review found a
paused Android trailLength reduction bug; native replacement now trims retained
trails immediately. A second pass found no additional important issues.

Runtime smoke: Android Google, iOS Apple and iOS Google displayed all four types.
Apple reverse ordering and heading90/pitch45 camera movement with live JS camera
events disabled retained geographic projection and polygon holes. Pausing stopped
Apple native draw counts (5022 unchanged across observations). Runtime checks
caught stale `running:true` diagnostics after pause; both backends now publish a
scheduler transition event. Detailed lifecycle/performance gates remain open.

Illustrative debug simulator samples,128 particles ×8 trail samples plus80 heat
points: Apple draw~1.2–2.0ms, projection~0.57–0.67ms; Android draw~43–81ms,
projection~39–77ms. Android cumulative max reached~299ms during camera/data work.
An iOS Google initial paused draw took~50ms including~45ms projection. These are
individual draw CPU samples under development/build load, not benchmarks or
presented FPS; simulation/GPU/compositor costs are excluded. They already reject a
claim that per-sample SDK projection is an adequate production particle backend.

See [shared-renderer.md](shared-renderer.md). Full alignment measurements,
background/resume and ancestor visibility fixtures, native numeric wind parity,
physical-device profiling and production GPU rendering remain unverified.

## SDK-native component direction — supersedes shared renderer

The user rejected the shared renderer and accepted provider zIndex limitations.
All shared native drawing surfaces, particle loops and renderer stats events were
removed. Polyline/Polygon remain standalone public components, backed by the
existing SDK-native shape adapters. Heatmap and ParticleLayer exports were removed;
provider-native implementations remain planned. The source/layer model is internal
transport, not the public API. The shared-renderer measurements above are historical.

`npm run check` passed36 tests, type checks, codegen and packed consumer checks.
Both Metro bundles and pod regeneration passed. Review found and fixed bounded
internal IDs and weak caching for replaced polygon-hole arrays. Style updates reuse
source array/data/revision; geometry replacements increment internal source revisions.

Final SDK-native ARM64 Android debug and iOS simulator builds passed. Rebuilt apps
smoke-checked SDK shapes on Android Google, iOS Apple and iOS Google. Android
accepted z-order reversal and geometry replacement, and camera movement with live
JS camera events disabled. iOS Apple displayed polygon holes and route strokes.
These checks establish the component path, not universal z-order or geographic
edge-case parity.

## Shape components — 2026-10-20

Added Circle (meter radius, spherical 128-segment geometry), stroke caps/joins,
miter limits and dash patterns to the package-owned shape compiler and both native
MapLibre style adapters. Polygon/Polyline/Circle support optional IDs and typed
`tappable` press callbacks with coordinate and map-relative logical-point position.
Native picking skips noninteractive layers; iOS now traverses actual style order.
Zero-radius circles produce empty feature collections rather than stroked
zero-area polygons. See `docs/shapes.md` for compatibility and geometry limits.

Verification: `npm run check` passed with 41 contract tests, public type tests,
Codegen and packed declaration-consumer checks. Production Metro bundles passed
for both platforms. Android ARM64 debug and iOS simulator-target native builds
passed; iOS required regenerating the example's Pods/Codegen event headers.
Review found and corrected zero-radius geometry and iOS beforeId pick ordering.

A simulator smoke check began before the user requested no simulator testing here.
iOS displayed the three shapes and a Circle tap selected `harbor-circle`.
Further device interaction was stopped on that request. No completed Android
shape-runtime check, physical-device verification, or performance claim is made.
Future verification in this chat should use static checks and builds unless the
user authorizes device interaction.

## Native source revisions — 2026-10-20

Explicit optional GeoJSON source revisions now survive scene compilation and are
validated by map-owned Java/C++ gates in the MapLibre hosts before existing scene
resources are removed. Lower revisions, changed data at equal revision and dropping
a present source's revision reject the entire scene with recoverable `layer-scene`
errors. Accepted state advances only after successful native application. Unversioned
sources and generated shapes retain replacement behavior. Source removal ends its
revision lifetime; style reload retains accepted data and can replay the accepted
scene when current props are stale. Android style callbacks check request generation
and disposal; iOS checks map/style identity and owns state in its non-recycled view.
See [contract and limits](source-revisions.md).

Fresh verification for this change:

- `npm run check` passed: lint/format, TypeScript, 44 contract tests, Codegen and
  packed declaration consumers. Three new tests execute the scene transport and
  standalone Java/C++ gates. Native scenarios cover stale/equal/newer revisions,
  rejected batches, optional versions, safe-integer bounds, source removal/re-addition,
  independent maps and disposal. A signed-zero Java regression failed before the
  numeric equality correction and passed afterward; read-only code review found
  the same issue and no further actionable findings.
- `npm run example:bundle` passed production JS bundling for iOS and Android.
- `npm run build:android -- -PreactNativeArchitectures=arm64-v8a` passed after the
  final Java correction; `npm run build:ios` passed the iOS simulator-target build.
  Initial sandbox attempts could not access Gradle/Xcode resources; approved
  compile-only retries passed using existing caches.

No simulator/device interaction was performed. These checks verify transport,
standalone gate behavior and native compilation; integrated runtime style-reload,
error delivery and disposal scenarios remain unverified. Arbitrary SDK mutation
failures are not transactionally rolled back. Large-update cost, source patches
and asynchronous indexing/cancellation remain separate work.

## Marker child gesture ownership — 2026-10-20

Android reserves marker-target touch streams before SDK handling using React Native
hit-test paths. A later native responder claim cancels the SDK once; reservation
persists through removal/release until UP/CANCEL and resets on detach/disposal.
iOS SDK recognizers and package feature picking reject marker-descendant touches
at receipt rather than polling asynchronous JS responder state. See [contract](marker-gestures.md).

`npm run check` passed 45 contract tests, types, lint/format, Codegen and packed
consumer checks. The new native Java gate regression was run red before implementation
and passes for initial/late claims, terminal reset, interrupted streams and independent
maps. Android ARM64 and iOS simulator-target native builds passed. No devices or
simulators were interacted with; integrated touch routing, nested scrolling and
full GEST-05 coverage remain unverified.

## Runtime map capabilities — 2026-10-20

MapLibre hosts now include engine/platform and feature evidence states in readiness
reports. The public ref exposes `getCapabilities`, and `onCapabilitiesChange`
receives frozen validated snapshots or invalidation. Circle/line/fill remain
unvalidated; absent native integrations are unsupported. A view-owned style request
revision prevents queued old reports from restoring readiness, including repeated
URLs and detached maps. Native iOS readiness emitters use a loaded revision snapshot.
See [capability contract](capabilities.md).

`npm run check` passed 49 tests, types, lint/format, Codegen and packed consumers.
New tests execute both native report producers, validate report bounds/schema/
immutability and exercise readiness replacement/deactivation. The queued-readiness
regression failed before adding request-state enforcement and passes afterward.
Production bundles passed on both platforms. Regenerated example Pods/Codegen,
Android ARM64 native build and iOS simulator-target build passed. Read-only review
found the queued-event issue, which was corrected. An additional same-URL concern
was checked against pinned MapLibre core `src/mln/style/style_impl.cpp::loadURL`:
it unconditionally creates a request, so URL equality does not suppress that path.

No device interaction was performed. Runtime callback delivery, style recovery and
the underlying feature quality gates remain unverified.

## Scene-wide input budgets — 2026-10-20

Compiler transport now applies aggregate 50,000 declared positions, 100,000
layer-weighted positions and 4 MiB UTF-8 JSON limits, including generated shapes.
Both native hosts independently reject oversized byte payloads before parsing or
resource replacement. See [budget contract](scene-budgets.md).

`npm run check` passed 54 tests, types, lint/format, Codegen and packed consumers.
Five new compiler/accounting tests failed before implementation and passed after:
combined declared/rendered overflow, multibyte JSON overflow, UTF-8 surrogate/width
accounting, nested geometries and generated shape counts. Android ARM64 and iOS
simulator-target native builds passed; production bundles passed on both platforms.
Read-only review found no actionable issues. No device interaction occurred;
release performance, asynchronous work and broader native malformed-payload
coverage remain open.

## Native camera provenance — 2026-10-20

Idle events now report SDK-derived gesture/application/SDK/unknown origins. Android
records the SDK move-start reason and consumes it at idle; disposal resets the
tracker. iOS uses the public reason-aware completion delegate and native gesture/
compass/programmatic flags. Unknown JS/native values remain unknown. See
[camera origin contract](camera-origins.md).

`npm run check` passed 56 contract tests, types, lint/format, Codegen and packed
consumers. Native Java/C++ classification/tracker and JS normalization regressions
failed before implementation and passed afterward. Android SDK constants were
verified against the installed 13.6.1 AAR. Read-only review found no actionable
issues and confirmed the pinned iOS SDK dispatches/resets the reason mask.
Production bundles passed on both platforms; regenerated Pods/Codegen and Android
ARM64/iOS simulator-target native builds passed. No device interaction was performed.
Runtime origin timing, interruptions and controls remain unverified, so CAM-06 and
detailed gesture work remain open.

## Continuous gestures and simulator runtime — 2026-10-20

The user reauthorized simulator interaction after the earlier restricted work.
This supersedes the earlier no-interaction constraint for subsequent verification.
Tests used the dirty working tree based on `6ca4532f5805f8019df412e12d89dfbafcfa4e66`:
iPhone 17 Pro / iOS 26.1 (`059CBCC3-30D8-4E37-8AB0-6990E52BE02D`) and Pixel 9a
AVD / API 36 ARM64 (`emulator-5554`). No physical devices were used.

The development example's **Open verification** screen exposes bounded read-only
snapshots through `globalThis.__enhancedMapsVerification.snapshot()` and native UI
buttons for source/style/subscription scenarios. Raw snapshots are stored locally
under `artifacts/verification/native-runtime-2026-10-20/` (ignored build evidence).
iOS used Metro 8088; Android used 8089 to prevent debugger cross-device selection.
Runtime reads checked the returned device identity.

- Both platforms: background pan, pinch zoom, rotation and two-finger vertical
  tilt delivered begin/update/end with gesture camera provenance. iOS pinch
  changed zoom 13 to 14.1526, rotation changed heading to 305.977 degrees, tilt
  reached 60 degrees. Android wide pinch changed zoom 13 to 14.6998, rotation
  changed heading to 286.546 degrees and tilt reached 48.195 degrees. Android
  pan and rotation used independent overlapping sequence IDs.
- To reproduce Android zoom, pinch at normalized center (0.5, 0.65), distance
  0.15 to 0.7 over 250 ms. The slower 0.18 to 0.45 / 1000 ms input stayed
  below SDK recognition thresholds. Raw diagnostics confirmed correct pointer
  indices, distinct IDs, advancing times and enabled SDK gestures. Temporary
  diagnostic code was removed afterward; app touch semantics were not changed.
- iOS: remove the gesture subscriber, pan, then inspect the snapshot: the event
  count stayed 50 while the camera moved with gesture origin. Re-enable and set
  250 ms interval: pan sequence 4 delivered begin, five updates spaced at least
  250 ms, and end. Begin and end bypassed the update interval.
- iOS camera command changed heading/pitch to 45/35 with application origin and
  no new gesture events. Both platforms rejected an older source revision after
  advancing to revision 2, retained accepted data, and recovered it on style reload.
  Reports transitioned from native capabilities to null and back at readiness.
- iOS also rejected changed data at equal revision, then removed the source and
  successfully re-added revision zero with no additional error. Android marker
  slider moved to 96%, recorded one drag and left camera-idle count unchanged.

Native Java/C++ gates and JS contracts cover throttling, simultaneous slots,
terminal uniqueness, cancellation, latest focal point, invalid inputs and
unsubscribed reset. Both native builds passed with the gesture integration.
These are smoke checks, not complete checklist acceptance: active interruption,
quick zoom, marker/container combinations, stress, release performance and
physical-device coverage remain open. Capability states remain unvalidated.

Final `npm run check` passed 58/58 tests plus types, lint/format, Codegen and
packed consumers; both production bundles and the final Android ARM64 build
passed. The iOS gesture build had already passed before runtime verification.
Marker tap and 900 ms long press each updated the intended counter on both
platforms; iOS slider reached 97% / one drag, with camera-idle count staying one.
Overlapping marker input selected B initially, then A after changing zIndex,
then later-mounted B at equal zIndex on both platforms.

Observed open defect: iOS accessibility reports anonymous marker annotation
buttons at incorrect frames over the toolbar instead of exposing the React
child labels at their rendered map positions. Touch input at rendered positions
works, but this does not pass screen-reader acceptance (A11Y-01). Screenshot
fallback was required for those marker child targets; Android exposed them.

## iOS marker accessibility repair — 2026-10-20

The preceding defect was reproduced with native accessibility assertions before
the fix: Stack marker A/B labels were absent and anonymous EMMarkerAnnotation
frames appeared over the toolbar. The pinned MapLibre iOS 6.31 annotation class
overrides `isAccessibilityElement` to expose a callout leaf and returns a
map-local accessibility frame. The package wrapper now returns NO for the leaf
flag and converts its bounds to screen coordinates, allowing React child
accessibility traversal. Stacking example Pressables explicitly declare button
roles. No SDK files were patched.

Native assertions now find both Stack marker A/B with frames inside the map;
after panning, B's x frame changed from 0.32587 to 0.40216, and remount restored
the initial frame with both button traits present. Live counter Increment/Reset
labels and frames are exposed; tapping Increment changed Count 0 to Count 1
without changing camera-idle count. Native before/after/panned/remounted JSON
is retained in the local runtime evidence directory. Native iOS build passed;
read-only review found no actionable findings. This closes the observed wrapper
defect, not the full A11Y-01 screen-reader acceptance workstream.

After the repair, `npm run check` passed all 58 tests, types, lint/format,
Codegen and packed consumers; both production bundles passed. A documentation
formatting failure was corrected before the passing run.

## Native shape selection smoke checks — 2026-10-20

On both running simulators, open **Show native layers**, then **Hide points**.
The geographic Circle, Polygon and dashed Polyline remained visible. Tapping
their rendered fill/stroke regions changed the status to `harbor-circle`,
`harbor-area` and `harbor-path` respectively. iOS sample positions were normalized
(0.5, 0.616), (0.5, 0.48), (0.5, 0.67); Android samples were (0.5, 0.606),
(0.5, 0.487), (0.5, 0.672). These depend on portrait layout and toolbar wrapping;
use fresh screen discovery rather than treating them as fixed cross-device taps.
Android's immediate post-tap capture can precede the JS status update; a fresh
describe confirmed the final selected identifier. GPU shapes have no individual
accessibility targets, so visual fallback was needed for their rendered regions.
This verifies basic routing only; coordinate accuracy, holes, antimeridian,
style replacement and the full SHAPE-02/PICK matrix remain open.

## Lifecycle and structured feature hits — 2026-10-20

Both running simulators backgrounded to Home and resumed with the verification
map, readyCount 1, retained capabilities and no errors. Remount then raised
readyCount to 2; a new pan delivered begin/update/end and gesture-origin camera
idle (13 iOS samples, 9 Android samples). A concurrent long-swipe/Home experiment
was serialized by the simulator backend and ended normally; it does not prove
mid-gesture cancellation. Those native gate tests remain separate evidence.

GeoJSONSource now has a structured onFeaturePress callback alongside its legacy
feature-ID callback. Native SDK hit events include layer/properties and the ready
style revision; JavaScript validates the payload and rejects old-style events.
Properties come from the hit, avoiding incorrect lookup in rejected React data.
See [picking contract](feature-picking.md).

Parser and structured-only source interactivity tests failed before implementation
and passed afterward. `npm run check` passed 60/60 tests, public type checks,
lint/format, Codegen and packed consumers. Both production bundles, Android ARM64
and iOS simulator native builds passed. Read-only review found no actionable issues.

On both installed builds, tapping the verification circle returned source
`verification-source`, layer `verification-dot`, feature `revision-point`, name
`Łódź`, flags `[true,null,3]` and revision 1. After advancing source revision to 2
and sending stale revision 1 at a different longitude, the rendered point still
returned revision 2. Style reload restored the accepted point and returned the
same properties with readyCount 2. Each of these three taps invoked both callbacks
once. Tap coordinates matched the source area and positions were map-relative
logical points. Raw before/resumed/remounted lifecycle and feature-hit snapshots
are retained in the local runtime evidence directory. This closes bounded PICK-01;
overlap lists, radius queries, clusters and full PICK-02/03 parity remain open.

## Confirmed feature tap routing — 2026-10-20

A simulator regression exposed iOS single-picker arbitration: double-tapping the
verification feature increased hits from 3 to 5 while zoom changed 13 to 14.
Android zoomed to 14 and kept hits at 3. The package recognizer had no failure
dependency on SDK double tap. A further test found a 900 ms stationary iOS hold
selected a feature, while Android's SDK suppressed it.

The iOS picker now waits for the existing public one-finger multi-tap and quick-
zoom recognizers, plus an observation-only 500 ms long-press exclusion with marker
touch filtering. SDK handlers remain intact. On the final installed iOS build,
a 900 ms hold left hits at zero; single tap raised hits to one; double tap kept
hits at one and zoomed 13 to 14. Child marker button tap/long press still produced
Count 1 / long 1 and left camera-idle count one. Read-only review found no
actionable issues. Native iOS build, 60-test workspace checks and both production
bundles passed. Android native code was unchanged from its verified build.

Continuous one-finger quick zoom also passed on both simulators: iOS zoom changed
14 to 14.6267 with zoom begin/update/end and no additional feature press; Android
changed 14 to 14.4323 with zoom lifecycle and no additional feature press. To
reproduce with custom input, use Down, Up after 40 ms, Down after 80 ms, then 12
Move frames spaced 40 ms down by 0.009 screen height each and Up after 40 ms.
Do not interpolate between Up/Down phases: that earlier attempt produced pan
instead and was not quick-zoom evidence. Raw failing/final snapshots are in the
local runtime evidence directory. GEST-04 remains open for public map callbacks
and wider container/lifecycle integration.

## Public map presses — 2026-10-20

MapView.onPress now receives confirmed background taps; onLongPress receives one
native recognized hold, including over an interactive feature. Both carry typed
action/coordinate/map-relative logical position. Payloads are not constructed
without subscribers; native readiness/style revisions and JS validation reject
unready/obsolete/malformed events. Android map/feature press events cannot coalesce.
See [map press contract](map-presses.md).

The malformed native action/geometry test failed before implementation and passed
afterward. `npm run check` passed 61/61 tests, public types, lint/format, Codegen
and packed consumers. Android ARM64 and iOS simulator native builds passed, as
did both production bundles. Read-only native/API review found no actionable issues.

Both installed simulators passed the same callback-count assertions: one background
tap produced one map event and zero feature events; a feature tap produced one
feature event without another map event; a 900 ms hold over the feature produced
one long-press map event without another feature event. Background double-tap zoom
and continuous quick zoom left both counts unchanged. Removing both map callbacks
then tapping/holding left the map count at two with no errors.

The final development verification screen can overlay a labelled marker button
on that interactive feature. With map callbacks enabled, tap and hold each
incremented the marker's corresponding counter once on both platforms; map press
and feature-hit counts stayed zero, and camera-idle count stayed one. This proves
the integrated marker/feature/background boundary, rather than inferring it from
an example without map callbacks. Local snapshots use ios/android_map_press_*
filenames under the runtime evidence directory. Basic GEST-04 is complete; GEST-05
container, removal-mid-stream and multi-touch integration gates remain open.

## Native geometry queries — 2026-10-20

MapViewRef now exposes pointForCoordinate, coordinateForPoint and getVisibleBounds.
Native UI-thread SDK queries return correlated results through a bounded 32-request
broker with 5-second timeouts. Style change, unmount and fatal readiness errors
reject pending requests; duplicate/obsolete responses cannot settle newer work.
Arguments and small native result JSON are validated. See [contract](map-geometry.md).

Broker/result-validation tests failed before implementation and passed afterward,
covering out-of-order responses, duplicate/obsolete IDs, dispatch errors, native
errors, 32-request overflow, cancellation, timeout and malformed/nonfinite results.
`npm run check` passed 63 tests, types, lint/format, Codegen and packed consumers.
Both native builds and production bundles passed. Read-only review found no
actionable issues in the query lifecycle/units.

Both running simulators round-tripped the off-center coordinate (54.373,18.664)
through native projection and inversion. At heading 0/pitch 0, iOS returned point
(247.6034,143.9985) and Android (252.6034,199.4985), reflecting different viewport
sizes. At heading 45/pitch 35, points changed to (192.1512,146.3260) and
(197.0246,201.0004). Maximum rotated inverse error was 2.4e-12 degrees on iOS
and 7.9e-10 on Android. Native visible envelopes contained the fixture and changed
with rotation/pitch; all queries returned without errors. Center-coordinate
round trips were verified too. Raw ios/android_geometry_* snapshots are retained
in the local runtime evidence directory. Fit methods and full geographic-edge,
resize and lifecycle runtime matrices remain open under CAM-09.

Android verification required emulator recovery: Argent's uninstall step triggered
an API-36 system-server permission-policy NullPointerException, temporarily removing
the package service. A first reboot failed to register and was terminated by the
tool; a subsequent clean boot succeeded without wiping data. In-place adb install
then succeeded, avoiding another uninstall. This was system-service failure, not
evidence of an application crash.

The rotated query fixture also exposed a CAM-06 defect: Android's application
camera command reports sdk. Inspection of the pinned SDK AAR confirms both public
Transform.animateCamera/moveCamera and compass reset dispatch reason 3. Merely
swapping constant names would misclassify compass; a command-ownership fix and
runtime verification are the next action. iOS reported application as expected.

### 2026-10-21 · Android command ownership and SDK control layout

The Android command tracker now owns imperative/initial camera moves explicitly,
with generation-checked completion/cancellation callbacks. Native gesture begin
overrides the command independently of JS subscriptions. The SDK compass's native
click notification supplies SDK ownership without replacing its handlers. Copying
the current camera position preserves padding, allowing exact SDK no-op checks.
Standalone Java regressions failed before the new tracker operations existed and
passed afterward. Read-only review found no actionable issues in the tracker,
compass observer or layout correction.

On the running Pixel_9a emulator, the initial and 600ms command events now report
application. A repeat of the exact current camera emits no additional idle event.
A ten-second application animation interrupted by pan reports gesture, including
with JS gesture events disabled (zero gesture samples, camera origin still gesture).
Compass reset during a ten-second application animation ends at heading zero with
sdk origin, correcting the reproduced application label. An immediate subsequent
application command is classified application, and another exact repeat emits no
idle. No app map errors occurred in these scenarios.

Fresh mounts also exposed SDK controls remaining unmeasured until a later resize.
The host now coalesces SDK layout requests and measures only native SDK children;
Yoga still owns marker subtree measurement. Compass and attribution are visible
from a fresh mount, and a verification marker button still registers one press
with zero background/feature events after the repair.

iOS comparison passed application command and exact repeat (two camera events:
initial plus command). Its compass interruption exposed a separate defect: an
intermediate sdk callback is followed by application at heading zero. CAM-06 stays
open for this correction; neither platform's full CAM-08 matrix is established.
Raw camera_* snapshots are saved in the local runtime evidence directory.

`npm run check` passed 63 tests, types, lint/format, Codegen and packed consumers.
The final Android ARM64 native build and both production bundles passed. No iOS
native source changed in this slice. A universal APK installation exceeded emulator
storage; the smaller ARM64 build installed in place without wiping data. After
installation the Android automation service needed a scoped restart to restore
input delivery; ignored taps were not counted as verification.

### 2026-10-21 · iOS compass interruption ownership

The existing MLNMapView subclass now observes public resetNorth/resetPosition
operations, retaining SDK ownership through their internal programmatic callbacks.
Package commands and native gesture begin replace that ownership. A synchronous
application-call scope handles immediate camera callbacks carrying stale compass
flags; @finally clears it. SDK-equal camera commands return before claiming
ownership. Standalone C++ sequence regressions failed before the new tracker/scope
existed, then passed. Read-only review found no actionable issues.

On the rebuilt iPhone 17 Pro simulator, a ten-second application animation followed
1.26s later by compass reset now ends at heading zero with sdk origin. Both the
interrupted and final callbacks are sdk. The reverse test exposed a second edge:
compass followed 107ms later by an immediate application command previously ended
at heading 45 with sdk origin. After adding the synchronous command scope, the
same sequence ends at heading 45 with application origin. Exact-current-camera
repeat leaves the event count unchanged (six before and after). A ten-second
application animation interrupted by pan ends as gesture with JS gesture events
disabled and zero gesture samples. No map errors occurred.

Compass taps also exposed package background-tap recognition over the native
UIImageView-based compass. Excluding MLNCompassButton and UIControl descendants
from package map recognizers preserves compass behavior and yields zero map/feature
presses in both final interruption sequences. Before/failing and final raw
ios_compass_* snapshots are retained in the local evidence directory.

The final iOS simulator build and npm run check passed (63 tests, types, lint,
format, Codegen, packed consumers). Production bundles passed in the preceding
Android slice; no JS changed here. CAM-06 remains Prototype for the broader matrix,
and callback provenance does not establish final-idle or animation-completion
semantics under CAM-04/CAM-08.

### Camera fitting — 2026-10-21

Both running simulators passed padded explicit-coordinate fits at heading/pitch
0/0, then shortest-arc dateline fits and animated returns to Gdansk at 45/35.
Projection assertions check every fixture point against logical padding
top/right/bottom/left 20/30/40/50. iOS return points span y53.40–251.08 in a
295.67-point viewport; Android return points span y95.37–371.07 in a 447.24-point
viewport. Both preserve heading/pitch and report application camera origin.

SDK fitting alone failed containment in pitched and distant-world cases.
Recentered preflight and bounded native projection refinement address those
observed failures. Android animations must reuse the measured post-refinement
camera. The original dev harness sampled 900ms after acceptance and observed an
unfinished Android cross-world flight; allowing 3600ms for the 600ms request
passes. This establishes eventual containment, not animation duration accuracy
or a completion guarantee from the fit promise.

On both platforms, fitElements included accepted source revision 2 at longitude
18.67 plus the mounted marker at 18.66, after a stale candidate revision 1 at
18.64 was rejected. Removing source and marker made fitElements reject with
"No map elements to fit" and left camera event counts unchanged (iOS 6, Android
5). Expected stale-source errors remain nonfatal. Raw seeded/target snapshots,
including the failed early animated sample, are saved under the local ignored
native-runtime-2026-10-20 evidence directory.

Both native builds, npm run check (65 tests, types, quality, Codegen and packed
consumer resolution) and production bundles passed. CAM-09 remains Prototype:
full geographic and lifecycle matrices, timing, preflight rendering atomicity
and physical-device behavior remain unverified.

Follow-up: fixture fitting passed after style reload (ready count 2), and dateline
fitting passed after native-map remount (ready count 3), on both platforms. A
dev-only resize toggle then shrank each map to 160 logical points high and
expanded it without remount (ready count stayed 1). Pitched local and dateline
fixtures remained inside padding; both expanded maps fitted local geometry again
without query errors. Raw after_style, after_remount, resized and expanded
snapshots record those results. This is bounded resize evidence, not the full
MAP-08 matrix.

The initial 160-point pitched local fit zoomed out to approximately zoom 1 on both
hosts, despite the small local extent. A temporary Android trace confirmed that
this was the SDK seed (attempt 0), rather than projection zoom-out refinement.
A bounded 16-candidate tightening search now retains only projection-verified
cameras and restores the best one before animation. The same fixture passes at
zoom 9.42 on iOS and 9.44 on Android, preserves 45/35 heading/pitch, and spans less
than one degree latitude. Dateline fitting at 160 points and animated local
return after expansion also pass. tight_resized and tight_return snapshots
retain this regression evidence; temporary diagnostic logging was removed.
Review found no actionable issues. Final native builds and 65-test checks pass.
Final tightening code also passed accepted-revision/marker fitting and empty-map
rejection on both hosts; camera counts remained 8 on iOS and 6 on Android across
the empty fit. Final production bundles passed. tight_elements and tight_empty
snapshots retain those results.

Android landscape changed the viewport
to 923×112, but automation taps landed as map presses instead of control actions,
so landscape fitting was not verified. The iPhone example is portrait-only.

### Native gesture cancellation and resubscription — 2026-10-21

Both running hosts passed background cancellation for held native pan, pinch,
rotation and tilt. Send Down/Move without Up, inspect begin/update, press Home,
launch the same app and inspect cancel. Do not infer cancellation merely from a
completed swipe: the pre-background snapshots explicitly have no terminal.
Pan uses normalized (0.3,0.78) to (0.65,0.78), 500ms, 12 interpolated moves.
Pinch uses x0.4/0.6 to x0.2/0.8 at y0.78, 350ms. Rotation uses x0.3/0.7 at y0.78
to (0.4,0.70)/(0.6,0.86), 450ms. iOS tilt uses x0.35/0.65, y0.84 to y0.69,
450ms. Android's successful shove uses x0.35/0.65, y0.70 to y0.86, 250ms and
8 interpolated moves. The slower upward Android attempt recognized pan, so it
does not count as tilt evidence. Release old contacts separately before starting
each new gesture.

iOS cancellation evidence contains six begun IDs with one terminal each; Android
contains nine, including simultaneously active pan/zoom and pan/rotation. iOS
rotation overlaps zoom. Every active kind cancels independently; no duplicate
terminal appears after resume. The pan cancel uses the latest focal point even
when the last movement sample was throttled. A new pan after resume uses ID 2
and ends normally. No map errors occurred.

Cycle subscriber on the dev screen removes the subscriber at 6 seconds and
restores it at 10 seconds. Start a pan before the first transition and hold it
across both: Down (0.3,0.8), Move x0.4 after 500ms, x0.5 after 6500ms, x0.6 after
4500ms, x0.65 after 500ms, all at y0.8. On both hosts, gesture count at removal
and restoration stays 1, containing only pan ID 1 begin. Further held movement
and release do not resume that stream. After releasing, a fresh pan delivers
ID 2 begin/update/end. No errors occurred. This confirms intentional subscription
reset semantics; the removed subscriber is not promised a terminal event.

Raw `*_held`, `*_background_cancel`, `*_pan_resumed` and `subscriber_cycle_*` snapshots
are retained in the local ignored evidence directory. Native Java/C++ gate tests
and npm run check pass (65 tests, types, quality, Codegen, packed consumers).
These checks used the previously verified native builds; this slice changes only
dev verification controls and docs. Detach/disposal, navigation, nested containers
and physical-device matrices remain open; GEST-02/GEST-06 stay Prototype.

A final 250ms-interval pan delivered six updates on iOS with gaps 283–300ms,
and seven on Android with gaps 279–304ms. Each had begin and end; Android end
arrived 120ms after its last update. Both had zero errors. Raw
ios_gesture_250_final and android_gesture_250_final snapshots retain timestamps.
Production bundles passed after the subscriber-cycle control was added.

### Native clustering source and picking — 2026-10-21

Implemented the first clustering slice on installed MapLibre Android 13.6.1 and
iOS 6.31.0, using their existing GeoJSON indexes. Both native builds pass. The
dev-only Open clustering screen defines four stable Point features: duplicate-a
and duplicate-b at longitude 18.66, near-c at 18.662, isolated-d at 18.674, all
latitude 54.37. Source options are radius 50/maxZoom 14/minPoints 2, revision 1.
Locate cluster fixture uses native projection for tap targets. Native iOS view
inspection confirmed the map screen frame (0,305,402,535); Android discovery
provided its map frame. Input actions used native controls and native map taps.

At zoom 13 both hosts picked cluster:14 through fixture-clusters with properties
cluster=true, cluster_id=14, point_count=3, point_count_abbreviated="3". A separate
tap picked isolated-d through fixture-points. At zoom 16, taps picked duplicate-b
and near-c as ordinary points, with original properties. Screenshots confirmed
blue cluster/orange isolated styling at low zoom, and orange individual points
at high zoom. Picking one duplicate does not establish all leaf membership.

At low zoom, Stale min 4 changes settings at revision 1. Both hosts emit one
nonfatal layer-scene revision error and retain the pickable three-point cluster.
Accept min 4 advances revision 2 and produces ordinary duplicate-b/near-c hits.
Restore clustering advances revision 3/minPoints 2. Style reload (ready count 2)
and native-map remount (ready count 3) each retain the expected three-point
cluster. No additional errors occurred. Raw clusters_final_low/high,
clusters_stale_config, clusters_changed_config, clusters_style_replay and
clusters_remount snapshots retain the sequence.

Review found a possible collision between synthetic and original cluster: IDs.
A new regression failed before reserving that prefix in JS and both native
validators, then passed. Reviewed final builds were installed and each freshly
picked cluster:14/count 3 with zero errors (clusters_namespace_final snapshots).
The full check passed 68 tests, types, quality, Codegen and packed consumers.
Final production bundles passed after the namespace fix. Core package packed
size changed from 85173 to 89461 bytes; no new
runtime dependency or linked SDK was added. Native binary size and native index
resource use remain unmeasured.

See [clustering contract](clustering.md). Aggregation, full edge fixtures,
background/cancellation/memory behavior, accessible clusters and 1k/10k/100k
release-device benchmarks remain unfinished.

### Cluster inspection and index ownership — 2026-10-21

Added opaque handles on generated hits and child results, children/leaves pages,
and expansion zoom queries using the installed native SDKs. Both simulators
returned duplicate-a/duplicate-b on the first two-leaf page, near-c at offset 2,
total 3, and an empty page at offset 3. The parent returned child cluster:15;
querying that actual child handle returned the same three original leaves.
Parent and child expansion zoom was 15. Final child snapshots have no map or
query errors. Evidence: ios_cluster_child_final.json and
android_cluster_child_final.json under the ignored native-runtime-2026-10-20
verification directory.

Both hosts rejected copied handles, preserved held handles after a rejected
same-revision minPoints update, and rejected held handles after accepted
replacement, recoloring scene rebuild, style reload and map remount. A rejected
same-revision clustering-disable candidate exposed a JS classification bug: the
accepted visible cluster initially lost its handle. Hits now classify generated
clusters using native index metadata rather than unaccepted JS source settings.
Both hosts subsequently returned usable handles and valid leaf/zoom results after
that rejected candidate. cluster_handle_* and cluster_accepted_native_final
snapshots retain those sequences. Private stamps propagate through SDK cluster
aggregation and are removed from public properties.

Native iOS and Android final builds passed and were installed. Full check passed
71 tests, types, lint/format, Codegen and packed consumers; production bundles
passed. The resumed full check packaged the current combined worktree at 101596
bytes packed / 431519 unpacked. Review found no
new concrete bugs after the accepted-native-index fix. Child-query fixture
evidence initially omitted fields because the running Metro transforms were
stale; refreshing both caches and the fixture produced complete results. This
does not establish native index resource bounds, background processing, complete
boundary membership parity or release-device performance.

### Dense cluster pagination — 2026-10-21

The development fixture can replace its four points with 1000 or 10000 coincident
Point features at longitude 18.66 / latitude 54.37, with stable dense-N IDs and
ordinal properties. Switching advances the producer revision and clears held
selection. The audit uses actual tapped cluster handles and the public leaves
query, requesting 100 results per page; it compares the complete ID set with the
expected input, rejects duplicates/missing/extra IDs, checks frozen result
wrappers and requests the empty page at total.

Both installed native hosts passed 1000 unique leaves across 10 pages, then 10000
unique leaves across 100 pages. Every expected ID appeared once, all immutable
checks passed, both terminal pages were empty, and both sequences contained zero
map/query errors. Raw ios_dense_membership_final.json and
android_dense_membership_final.json snapshots are retained in the ignored
native-runtime-2026-10-20 verification directory. Read-only review found no
false-positive audit logic. Full checks passed 71 tests, types, quality, Codegen
and packed consumers; final iOS and Android production bundles passed. These
coincident-point correctness results do not establish
spatial-boundary behavior, frame times, memory bounds or 100k-point support.

### Custom GPU layer feasibility spike — 2026-10-21

Added an iOS Debug-only MLNCustomStyleLayer using MapLibre's Metal encoder and
projection matrix. The example owns shader source in JS (waves, radar and
checkerboard), sends bounded source/uniform changes through the existing internal
query command, and exposes below/above-symbol placement and native animation.
No public shader API, Android implementation or TypeGPU map path is claimed.

Final npm run check passed 71 tests, type/quality checks, Codegen and packed
consumers. Final iOS Debug build passed. A separate host-Mac Metal check compiled
the exact three assembled sources into libraries and render pipelines. These
checks do not verify frame times, runtime map ordering or projection alignment.

The initial native build was installed on the running iPhone simulator before
the user reported another agent using it. No further simulator interaction was
performed. Later shader-source/uniform builds were not installed by this agent.
The user described the initial prototype as looking nice. Device, lifecycle,
JS-contention and performance verification remain open. See
[prototype scope and authoring alternatives](custom-gpu-prototype.md).

### React Native WebGPU shared-output prototype — 2026-10-21

The Debug example now renders one WGSL module through RN WebGPU on iOS and
Android, and samples three pooled native output surfaces inside MapLibre's
render stack. IOSurface/Metal and AHardwareBuffer/EGLImage/GLES paths visibly
rendered waves and radar. Above/below-symbol placement, camera tilt/rotation,
style reload and map remount smoke checks continued rendering. Android's
available emulator uses a software Vulkan adapter; it was rejected by default
and then tested using an explicitly labeled diagnostic opt-in.

Package checks passed 72 tests, types, lint/format, Codegen and packed consumers;
both native Debug builds and both production Metro bundles passed. A dedicated
C++ regression covers output front/read/producer ownership and closure. Reviewed
Android fence-failure/context-loss fixes were rebuilt separately. No physical
Android, Release performance, device-loss or leak-stress acceptance is claimed.
The prototype uses main-JS encoding and asynchronous completion-mediated handoff;
it does not establish JS-independent animation or production fence scheduling.
See [full fixture, implementation and limits](webgpu-shared-output-prototype.md).

## TypeGPU cleanup (2026-10-21)

Removed the unused TypeGPU workspace, triangle/readback helpers, provisional raster
type and validator, obsolete tests, example dependencies and Babel transforms.
The react-native-webgpu prototype remains; TypeGPU is only a possible future typed
authoring adapter. Current checks pass 67 tests after retiring the five obsolete
tests. Both production example JS bundles pass with the standard React Native
Babel preset. No native code changed during this cleanup.

## World ShaderLayer and Worklets (2026-10-23)

The shared-output renderer now lives behind the optional `react-native-enhanced-maps/shaders` entry point. It publishes a bounded world tile atlas from a dedicated Worklets runtime through synchronous native JSI handles. Compute state belongs to the layer, not individual tiles; the wind example stores particle positions and tail endpoints in one persistent storage buffer.

Validation includes tile coverage/wrapping/budgets, native slot/metadata ownership and close behavior, revision-scoped teardown, and a mocked worklet submission test proving one compute update per atlas and preservation across tile changes/backpressure. Both native Debug builds and both production example bundles pass. A separate core-only Metro bundle rejects WebGPU/Worklets imports in its resolver and still passes.

iPhone 17 Pro simulator and Android API 36 emulator render the same procedural and wind WGSL. Controls exercise hot program swaps, uniforms, world/dateline cameras, layer visibility, multiple layers, remount and style reload. Native counters recorded 140 (iOS) and 50 (Android software diagnostic mode) atlas publications during separate three-second main-JS stalls with procedural rendering. These demonstrate scheduling independence, not physical-device FPS or GPU timings. The earlier 4096-particle diagnostic also continued publishing during a stall; the current visual example uses 1024 particles.

Review findings fixed: Android consumer polling under backpressure, native pool cleanup on React reload, timing consistency across failed acquisitions, and stale-style cleanup requests. Native redraws now follow publication/camera changes, with additional Android polls only while consumer reads remain pending.

Remaining limits are documented in [ShaderLayer](shader-layer.md): planar Mercator coverage, fixed atlas resolution, no LOD crossfade, no weather-texture streaming API, no automatic device-loss recovery, and physical-device projection/performance/energy acceptance still open.

## Release shader bridge diagnostics (2026-10-23)

Shader aggregate counters and per-pool bridge `stats` are now Debug-only exports.
Android source sets declare their own annotated transport methods because React
Native 0.85 scans concrete-class declared methods. Review caught an initial
inheritance-only implementation; the stronger compiled-method verifier reproduced
its missing-install failure before the forwarding-method fix.

Both Android Kotlin variants compile. `verify:android:bridge` inspects concrete
class annotations and confirms the exact Debug/Release export sets and synchronous
installation. iOS Debug and Release simulator builds pass with Xcode 26.2;
`verify:ios:bridge` confirms selectors and export metadata for arm64 and x86_64.
The worklet's private GPU-error check remains available in Release. Full package
checks pass 78 tests, types, lint/format, Codegen and packed declarations.

The corrected Android Debug APK assembled. Android Release app assembly failed
at Hermes compiler discovery: the workspace hoists `hermes-compiler` outside the
example root searched by Gradle. This is separate build configuration work, not a
successful Release app result. CocoaPods required local path-dependent checksum
regeneration in the isolated worktree; its four-checksum diff is excluded from
this change. Wider privacy and clean-Release-consumer acceptance remain open.

Physical-device Release testing was explicitly deferred to the maintainer on
2026-10-23. No physical-device gate is closed by these compilation checks.

## Shader geographic grids and zoom controls (2026-10-25)

Updateable scalar/vector grid resources now carry geographic bounds, projection,
channel layout, units, nearest/bilinear interpolation and validity masks. Grid
replacement changes bindings without recreating the persistent simulation.
Fractional camera zoom is available to WGSL and uniform worklets; inclusive
`minZoom` and exclusive `maxZoom` clear stale output and freeze simulation outside
the range while retaining state for reentry.

Verification passed: full `npm run check` (contract/native helper tests,
TypeScript, lint, formatting, Codegen and packed consumer declarations), production
Metro bundles for iOS and Android, and `node scripts/check-shader-grid-gpu.mjs`
against a temporary local Chrome software WebGPU adapter. The GPU check compiles
all example stages, creates their render/compute pipelines, and numerically checks
bilinear/nearest sampling, dateline wrapping, outside coverage, masked samples,
zero-weight missing neighbours, scalar fields, single nodes and removed data.
Worklet tests cover hiding/reentry, fractional zoom, frozen hidden time,
simulation binding preservation, one-time grid uploads and buffer disposal.

The optional GPU check requires a Chrome CDP endpoint on localhost port 9227; start
an isolated test instance with `--headless --enable-unsafe-webgpu
--use-angle=swiftshader --remote-debugging-port=9227
--user-data-dir=/tmp/shader-grid-chrome`, then build and run the script. Software
WebGPU is numerical/API verification, not hardware performance acceptance. These
checks do not claim native app simulator or physical-device runtime validation for
this extension. Physical-device checks remain maintainer-owned follow-up. Tiled
forecast loading and forecast-time interpolation remain unimplemented.

## Native shader grids and blue wind streaks (2026-10-26)

Current Debug builds passed for arm64 iOS simulator and Android emulator. iOS ran
on iPhone 17 Pro / iOS 26.1; Android ran on EnhancedMapsVerification / API 36 arm64.
Android required the explicit software-GPU diagnostic opt-in. Build recovery
refreshed CocoaPods integration after the package/directory rename and cleared
generated Xcode caches containing the old absolute path.

Simulator inspection found that 12 m/s forecast steps at 60 Hz rounded away in
absolute float32 world positions, leaving zero-length trails. A real WebGPU compute
regression reproduced the frozen positions; origin-relative integration fixes it.
The regression checks movement, ten-point trail history, reversal after live grid
replacement, and stable particle origins.

Both simulators rendered the blue tapered streaks. Zoom-range checks on both
platforms observed no new publications at 7.5 (below minZoom 8) or exactly 18
(exclusive maxZoom), continued publications at 8 and 17.9, and resumed publications
after return to 12. Display speed, trail length and density update through uniforms.

Live reversal with a uniform worklet also exposed callback round-trip serialization:
reading a worklet callback back from Synchronizable on RN and writing that rebound
copy could turn it into a remote function. Shader controls now keep an RN-owned
packet and publish patches without reading callbacks back. A regression covers
callback identity across pause, active, grid-version, replacement and stop updates.

Local evidence lives under `artifacts/shader-layer/`: native build logs,
`grid-check.log`, and simulator screenshots. The optional numerical/pipeline GPU
regression is `scripts/check-shader-grid-gpu.mjs`. These are simulator checks, not
physical-device throughput or energy acceptance; physical-device validation remains
maintainer-owned follow-up.

High-zoom follow-up reproduced loss of a half-pixel shift in the real vertex
shader at zoom 17.5. `mapRelativeTilePosition` now subtracts the tile origin before
adding local offsets. GPU checks verify the expected subpixel shift, smooth trail
sample interpolation, finite degenerate-vertex output, rejection of invalid
interpolation, and stable integrated stroke coverage across subpixel phases.
An iOS layer-hidden comparison confirmed the white dots belonged to the particle
layer. Invalid interpolation and zero-length segments are now rejected; subsequent
iOS and Android simulator inspection showed blue strokes without those white
speckles. Raster softness from 252² tile interiors remains a documented quality
limit; this change does not claim native-resolution particle output.

## Shader atlas final configuration (2026-10-26)

The final atlas remains 1024² with 252² interiors and two-pixel gutters. Shared
native constants and frame-derived WGSL mappings keep dimensions aligned. Each
triple-buffered pool uses 12 MiB. Both arm64 Debug builds passed; rebuilt apps were
installed and blue wind trails rendered on iPhone 17 Pro / iOS 26.1 and Android
API 36 (explicit software GPU diagnostic opt-in). Physical-device validation
remains maintainer-owned follow-up.

The isolated PR branch against current main passes all 256 repository tests,
production example bundles on both platforms, and the software WebGPU sampling,
projection, trail and coverage regressions. Initialization cancellation and
callback-ownership tests retain the current recovery/lifecycle behavior.

## Viewport ShaderLayer (2026-10-26)

ShaderLayer now renders only a viewport; the atlas allocation, tile selection,
tile metadata, compositor loops and rendering-mode switch were removed.
Rectangular shared textures carry geographic camera snapshots atomically, and
native composition reprojects completed output into the current camera. A guard
band of 25% of the shorter output dimension supplies offscreen coverage at the
same raster density. Large jumps can still outpace finite coverage.

The default resolutionScale is 0.5 (25% of full-resolution pixel count). The
example offers 50%, 75% and 100% comparisons. Native composition enforces
inclusive minZoom and exclusive maxZoom independently of worklet publication.

Both arm64 native Debug builds passed and were installed on iPhone 17 Pro / iOS
26.1 and Android API 36, with explicit Android software GPU diagnostic opt-in.
Blue trails were inspected at fractional zoom, pitch and rotation. Production
and native sampling counters advanced with one pool per app.

All 256 repository tests pass, including guard-band density, resolution scaling,
zoom visibility, initialization cancellation and persistent simulation. Software
WebGPU checks pass for fractional-zoom particle projection and pitched procedural
world/UV interpolation at interior raster pixels. Production bundles pass on
both platforms. Read-only review found no remaining concrete blockers.

Resizing or changing resolutionScale currently recreates simulation resources.
Fragment shaders reading built-in UV must match its @interpolate(linear)
annotation. WGSL now uses worldOrigin and screen projection helpers; the old tile
fields and helpers were removed. Rebuild native apps for the rectangular output
transport and native zoom gate. Physical-device performance/energy validation
remains maintainer-owned follow-up.
