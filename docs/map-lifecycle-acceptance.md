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
