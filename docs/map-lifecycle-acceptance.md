# Repeated map lifecycle verification

The Debug example's “Open lifecycle” screen runs at most 100 remount cycles.
Each cycle waits up to 15 seconds for its own generation's map-ready event,
requires the previous ref to reject with `Map is not ready`, and validates a
finite, ordered native bounds response from the replacement map. Native query
timeouts and unrelated errors fail the run. Query timers are cleared; cancellation
and screen disposal record cancellation rather than success. Results are bounded
in `__enhancedMapsLifecycle.snapshot()` and per-cycle Debug logs.

On 2026-10-23, iPhone 17 Pro / iOS 26.1 Debug passed 100 strict cycles with no map
errors. The iOS binary included the settings/padding work from PRs #22/#23;
this harness changes only example JavaScript. Those settings/padding PRs are now
merged. The remount verification harness is complete. Memory/resource drift,
background/navigation and multiple-map scenarios remain separate coverage work.
Physical-device Release checks are maintainer-owned follow-up and do not block
the harness's completion or this PR's readiness. No device results are claimed.

Android Pixel 9a ARM64 / API 36 Debug passed all 100 cycles with no map errors
on the main-based native build, started through the UI without the JS debugger.
The run took approximately 165 seconds; this is a harness duration, not a startup
or frame-time benchmark. iOS immediate cancellation and Android cancellation after
20 completed cycles recorded `cancelled`, not `passed`.

Generated snapshots are saved under `artifacts/verification/lifecycle-*-2026-10-23.json`.

## Android host and window lifecycle (2026-10-27)

The Android map now starts/resumes MapLibre only when both its React application
host is resumed and its native window is attached. Detach pauses SDK rendering;
a later host-resume event cannot restart a detached map. Attaching while the
host is backgrounded stays paused. SDK start/stop is balanced separately: a
transient detach retains its shared file-source activation until host pause or
disposal, while reattachment resumes rendering without a duplicate activation.
Disposal permanently closes this state.
Marker frame scheduling, frame execution and cluster-layout publication use
the same running state. Detach and backgrounding cancel snapshots, pause native
location, cancel marker drags/gestures and remove marker frame callbacks;
foreground host pause preserves delivery of the snapshot cancellation response.

The production Java gate is exercised through native helper tests for both event
orders, duplicate events, background attachment, detach/resume, disposal and
100 independent two-map transition cycles. A mutation removing the attachment
constraint fails that test. These are lifecycle-transition assertions, not
measurements of MapLibre allocations or rendered frame counts. Package checks
pass all 283 contracts, type checks, lint/format, Codegen and packed declarations;
the Android Debug example builds and both production JavaScript bundles pass.

The final gate passed all 100 strict remount/readiness/stale-ref/native-bounds
cycles on EnhancedMapsVerification / Android 16 API 36 ARM64 Debug, started from
the native UI without a JS debugger. The final viewport displayed the basemap
without interaction, and one Home/foreground return preserved map rendering and
the completed result. Local scoped logs and screenshots are under
`artifacts/verification/android-host-lifecycle-final-2026-10-27.*`. Metro reported
a Fast Refresh disconnect during this final run as well; the harness still
completed. These are bounded correctness and final-viewport observations, not
per-cycle visual assertions, hardware results or allocation measurements.

An initial implementation that fully stopped the SDK on detach passed a retry
of the 100-cycle readiness/query harness but left a blank basemap until a pan.
A comparison APK using the unchanged main view implementation passed the same
100-cycle harness and displayed the basemap without interaction. The final gate
therefore separates pause/resume from start/stop rather than treating each window
detach as a full SDK stop. This comparison does not establish which underlying
SDK/network operation caused the blank viewport.

The first emulator remount attempt timed out waiting for generation 9 after eight
completed cycles; Metro also reported a connection abort during the run. No
native process crash was observed, and background/foreground restored visible
map rendering. This failed attempt is not a pass and its cause was not isolated.
The broader lifecycle/failure/resource matrix remains open.

## Debugger limitation

An Android run with the JS debugger attached crashed on the JS thread with a
SIGSEGV. Symbolication against the exact cached Hermes debug ELF resolved the
first frames to `CodeBlock::getDebugSourceLocationsOffset` and
`Debugger::runDebugger`. This matches the reported upstream debugger failure in
[Hermes #2118](https://github.com/facebook/hermes/issues/2118), including the exact
RN 0.85.3 / Hermes `250829098.0.10` versions. It is evidence of a matching signature,
not proof that every lifecycle crash has that cause.

To separate this from map behavior, the Android app was rebuilt from the exact
main-based native source and the run started through its native UI without a
JS debugger attached. Collect progress with scoped logcat and inspect the final
UI before reconnecting a debugger. Do not count an interrupted/crashed run as a
pass. Dependency changes or upstream patches need separate verification.

## Explicit style recovery and interrupted output — 2026-10-28

`MapViewRef.reloadStyle()` retries the current style URL without remounting the
native map. It immediately invalidates command readiness, selected callouts,
shader readiness and pending queries, then advances the style revision. It returns
`void`: use `onMapReady` for completion and `onError` for failures. Calls on an
unmounted or obsolete ref throw. Reloading is explicit and does not create an
unbounded retry loop. It preserves the native camera unless an existing controlled
camera/region prop reapplies it. Source resources are reconstructed through the
existing accepted-scene path. Snapshot work and native marker drags are cancelled
by style replacement; cluster handles become obsolete.

Both native hosts report `style-load` with the current style revision. Queued error
events from older revisions are ignored by JS. A failure before readiness blocks
late readiness reports for that revision until explicit reload or a different URL
starts a new revision. A load error after readiness remains recoverable and does
not by itself disable camera/geometry commands. Native SDK error callbacks do not
identify their original request; revision scoping protects queued bridge delivery,
not SDK-internal attribution of errors between overlapping requests.

iOS uses MapLibre's `reloadStyle:` for same-URL requests; setting an unchanged URL
alone is insufficient. Reload does not promise cache bypass or downloaded offline
data. See [MapLibre's reload contract](https://maplibre.org/maplibre-native/ios/latest/documentation/maplibre/mlnmapview/).

Snapshot background cancellation now invalidates view-local generation ownership
before invoking native cancellation on both hosts, as detach/style/disposal do.
Late output cannot clear a newer operation or be delivered after interruption.
Interrupted snapshot promises remain bounded by the query timeout (five seconds)
when their native result is suppressed; explicit style reload/unmount cancels
pending JS queries immediately.

Automated coverage includes failed initialization, same-revision late reports,
explicit retry, stale refs/revisions, independent maps, 100 failed-load/retry/query
cycles with zero remaining scheduled query timers, and matching Java/C++ snapshot
generation tests for 100 interruption cycles. Existing Android native lifecycle
transition tests cover host/window pause/resume, navigation, interrupted startup,
terminal disposal and independent maps.

These are state-machine and native-helper checks, not native app runtime results.
No simulator runs or native app builds were performed for this change. Resize/
rotation rendering, real poor-network/offline recovery, native allocation counts,
memory drift and background/resume visual acceptance remain open. The broader
MAP/PERF checklist is not closed by this bounded recovery change.
