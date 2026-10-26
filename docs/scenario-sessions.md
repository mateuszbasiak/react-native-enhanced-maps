# Debug scenario selection and collection

The example exposes `globalThis.__enhancedMapsScenarios` in Debug builds. This is
an example verification interface, not a package export. It is absent from both
production bundles. Existing manual buttons remain available, but only one
scenario is mounted at a time; opening another replaces the previous one.

`scenarios` lists `markers`, `shapes`, `settings`, `runtime`, `clusters`,
`lifecycle`, `shape-picking`, `gradients`, `shader` and `webgpu`. `select(id)` returns a new
`{id, generation}` and remounts that scenario even if it was already selected.
`selection()` returns the current selection. Readiness collection waits until App
has committed the exact generation, so a previous fixture cannot satisfy it.

```js
const api = globalThis.__enhancedMapsScenarios;
api.select('runtime');
void api
  .collect(
    {
      sourceCommit: 'YOUR_SOURCE_COMMIT',
      nativeBuildCommit: 'YOUR_NATIVE_BUILD_COMMIT',
      device: 'Your simulator/device label',
      seed: 42,
    },
    15000,
  )
  .then((record) => {
    globalThis.scenarioRecord = record;
  });
// Read globalThis.scenarioRecord after the promise completes, then save its JSON.
```

Replace the commit placeholders with actual 7–40 hexadecimal Git revisions.
These fields and the device label are caller-supplied provenance; the interface
cannot verify which checkout produced an installed native binary. Use separate
source/native commits when a JS-only change uses an existing compatible binary.
`seed` is a required unsigned 32-bit run label for caller-driven inputs; it does
not randomize the existing deterministic fixtures. Extra metadata fields are not
copied. The environment records platform, OS/API version, runtime React Native
version, pinned SDK baseline and Debug mode. SDK baseline is not a runtime SDK
version query. Keep screenshots and native/JS traces as separate artifacts tied
to the same record; collection does not create those files.

## Outcomes and bounds

Readiness adapters exist for `settings`, `runtime`, `clusters`, `shape-picking`
`gradients` and `shapes`. Other scenarios return `skipped` with a reason; use their dedicated
interfaces for their own checks. In particular, selecting lifecycle does not run
its cycle test. A readiness record has one of these statuses:

- `ready`: this generation reported map readiness without a recorded fixture error.
- `timeout`: readiness was not observed before the deadline, including a polling
  callback delayed beyond that deadline by a busy JS thread.
- `cancelled`: selection changed or the App session was disposed while waiting.
- `failed`: the fixture reported an error, inspection threw, or evidence could not
  be bounded/copied.
- `skipped`: no readiness adapter exists; this is not a passing check.

`ready` does not mean presses, visual alignment, accessibility, memory, shader
execution or any other semantic scenario passed. Apply those assertions and record
their evidence separately. Maps may report readiness while tiles continue loading.

The timeout defaults to 10000ms and accepts integer values 1–60000ms. Polling uses
50ms intervals, with the remaining deadline limiting the next wait. Scheduling can
delay delivery beyond the deadline; duration records actual elapsed monotonic time.
Evidence is copied, recursively frozen and limited to 65536 JSON characters (at
most 256KiB UTF-8); oversize or cyclic snapshots fail rather than truncate.
Unexpected inspection exceptions produce a generic reason without copying their
message. Invalid metadata or timeout values reject the promise before waiting.

## Verification

Nine deterministic contracts cover committed generations, same-scenario remounts,
late readiness, cancellation/disposal, timeout/skip, errors/evidence bounds and
metadata validation/copying. The late-readiness test first reproduced a review
finding where readiness could succeed after the deadline. The deadline is now
checked before readiness inspection. Full package/production-bundle checks and
Debug simulator smoke are recorded with the PR's final evidence.

This completes selection and readiness collection infrastructure under
TEST-05–09/11. Consolidated semantic assertions, controlled visual baselines,
alignment and trace automation remain checklist work. Physical-device validation
is maintainer-owned follow-up.

### Debug simulator smoke, 2026-10-25

Source `2e61324` ran against the existing compatible native Debug binaries from
`9076f0c` on iPhone 17 Pro/iOS 26.1 and Pixel 9a ARM64/API 36. Each produced
`ready` for settings, runtime, clusters, shape picking, shapes and gradients,
then `cancelled` for a superseded settings session, `timeout` for a 1ms deadline
and `skipped` for lifecycle without an adapter. Records include the runtime
platform/OS/RN and pinned SDK baseline, separate source/native provenance and
seed label 42. Full local CI passes 123 tests, strict types, lint/format, Codegen,
packed-package checks and both production bundles. No native code changes were
made by the session infrastructure. These are selection/collection checks, not
new semantic, memory, performance or physical-device acceptance results.
