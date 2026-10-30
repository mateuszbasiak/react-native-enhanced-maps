# Native Overlay image loading

Overlay replacements stage their images before replacing the accepted native
scene. Each map loads and decodes serially off the UI thread, reusing images only
by the accepted scene's URI keys. HTTP(S) responses download to temporary files;
Android removes its files in `finally`, and URLSession owns its download files.
The candidate commits only after all its images have decoded. Failed candidates
are released and report recoverable `layer-scene` errors; accepted image pixels,
source revisions, fitting and native hit geometry remain available.

New input, style changes, backgrounding, detach and disposal cancel obsolete
work. Generations and style identity reject late completions. Resume retries the
current scene. A new style first reinstalls the accepted scene from its decoded
images, then stages the current candidate. iOS task creation and session
invalidation share a lock; atomic pointers alone cannot make that race safe.

There is no fixed image-count, URI-length, encoded-byte or decoded-byte quota,
and no fraction-of-RAM policy. Android queries `GL_MAX_TEXTURE_SIZE` on the map
renderer thread and chooses a BitmapFactory sample that fits it. iOS queries the
runtime Metal GPU family and uses [Apple's published texture dimensions](https://developer.apple.com/metal/capabilities/):
Apple2 8192, Apple3 and Mac2 16384, Apple10 32768. Unknown capabilities reject
recoverably rather than guessing. Decode/allocation failure can retry smaller
images. These are platform constraints and allocation feedback, not measured
scene-memory capacity. Keeping accepted and candidate images temporarily requires
memory for both; total memory is not constant, and process memory pressure or
unexpected SDK resource-add failures are not proven recoverable by these checks.

## Verification — 2026-10-30

The original iOS reproduction removed all 77,440 fixture-colored pixels after an
HTTP 404 replacement and reported no error. Correcting the URI restored them.
That reproduction is in the ignored `artifacts/verification/overlay-failure/`.

With staging, iPad Pro 13-inch (M5) / iOS 26.4 and Small_Phone / Android 17 API 37
ARM64 preserve the same 77,440 accepted pixels after a 404 candidate whose bounds
move from latitude -5…5 to 35…45. Both report recoverable errors, route a native
press to `overlay`, and fit the accepted scene around latitude zero. Android and
iOS also preserve accepted pixels across style reload with a failing candidate.
Corrected images replace the scene normally.

Both apps cancel a confirmed live 15-second image response when backgrounded:
the fixture observes premature socket closure, with no completed response. Resume
starts a new request, which completes; native fitting then centers around
40.183893764 degrees, the Mercator midpoint of the newly accepted 35…45 bounds.
A newer scene also cancels a confirmed pending response on each platform. These
runs distinguish requests that actually started from work paused before dispatch.

The iOS simulator's standalone loader probe checks the coordinated task-creation
race, main-thread completion, valid decoding, HTTP/decode rejection, release of
failed candidates, GPU-family downsampling, obsolete completion suppression and
close. Its race regression fails before synchronization and passes after it.
A 50,000×2 PNG decodes to 8192×1 on the simulator's reported GPU family. Android's
app also accepts the oversized fixture without another scene error. Shared Java
helper checks cover sample boundaries, integer overflow/allocation retries and
nested/escaped `asset://` paths. JS and both native validator corpora accept nine
and seventeen images and image URIs over 4096 characters; malformed inputs still
reject.

After integration with main’s measured JSON guard, `npm run check` passes
394 tests, lint/formatting, types/declarations, Codegen and package checks. Both
ARM64 Debug native builds and both production JavaScript bundles pass. Detailed local receipts/screenshots are under the ignored
`artifacts/verification/staged-overlay/`. The debugger tool's device-discovery
error required a direct Metro connection that checked app ID and device name on
every evaluation. Earlier lifecycle attempts whose URLs completed immediately
were excluded; request/close timestamps establish the counted delayed runs.
Physical-device validation, peak-memory/performance measurements and broader
image-format/geographic rendering matrices remain separate follow-up.

## Reproduce

Start `node scripts/rendering-fixture.mjs` (port 8102 by default), or set
`ENHANCED_MAPS_FIXTURE_PORT` for an isolated instance. Its routes include
`/image.png`, `/missing.png` (404), `/corrupt`, `/wide.png` (50,000×2),
`/slow?delay=15000` and `/transport` request/close records.

In the Debug rendering scenario, `__enhancedMapsRendering.configure` accepts
`imageURI` and `latitudeOffset` in addition to the original options. Use
`http://127.0.0.1:8102` on iOS and `http://10.0.2.2:8102` on Android. Its `snapshot`,
`reloadStyle`, `remount`, `fit` and `cameraState` methods collect the scene and
lifecycle checks. Wait for a recorded delayed request before cancelling it.

Compile the standalone probe and run it inside a booted iOS simulator:

```sh
xcrun --sdk iphonesimulator clang++ -arch arm64 -mios-simulator-version-min=16.0 -fobjc-arc -framework Foundation -framework UIKit -framework CoreGraphics -framework ImageIO -framework Metal tests/native/OverlayImageLoaderProbe.mm packages/maps/ios/StagedOverlayImages.mm -o /private/tmp/overlay-image-probe
xcrun simctl spawn <simulator-udid> /private/tmp/overlay-image-probe http://127.0.0.1:8102
```
