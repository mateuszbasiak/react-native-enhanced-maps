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
