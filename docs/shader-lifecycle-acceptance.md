# Shader lifecycle clock acceptance

The Debug example's **Shader lifecycle** scenario (`shader-lifecycle`) renders
independent blue and orange shader maps. Its callbacks record simulation time,
delta, frame count and resource epoch on the rendering worker. The bounded
AppState trace records both probes at each activity transition, without needing
the debugger to execute while the app is suspended.

## Reproduced resume failure

Before the activity fix, both iOS and Android reported `[Worklets] Tried to
synchronously call a Remote Function` after background/resume. Both layers
stopped and released their atlas pools. Worklets 0.12.2 implements synchronizable
functional updates by deserializing the previous value on the calling runtime
and serializing the returned value. Spreading that value on the JS runtime
round-tripped callback uniforms as remote-function wrappers. Activity changes
now serialize the original current uniforms prop, as pause/prop updates already
do. This preserves callbacks without recreating shaders or their devices.

## Observed checks

On October 25, 2026, the API 36 ARM64 Android verification emulator and iPhone
17 Pro / iOS 26.1 simulator passed these semantic checks:

- Both maps advance independent frame and simulation clocks.
- Pausing A freezes its simulation time and sets delta to zero while B continues;
  resuming A continues without another ready callback.
- Changing A's style waits for its new native map-ready acknowledgment and shader
  epoch; B retains its epoch and advances.
- Invalid WGSL in A releases its pool and records a current error; B continues.
  Restoring A returns to two pools with no current errors.
- Removing A, repeating the same removal control, and mounting A again preserve
  B's clock and readiness. Repeating the control checks control idempotence;
  it does not prove two direct native cleanup calls.
- Native Home followed by foreground launch preserves both maps' exact frame
  counts and simulation times between background and active trace records.
  Afterwards both clocks advance, ready counts remain unchanged, two pools stay
  attached, and neither map reports an error.

Foreground fixtures were initially verified at `bf9105e`; the activity fix is
`45a8714` and the transition recorder is `63fbac3`. Android reused the native
binary from `0f4cf95352f04367ccf0f23c90cad01e14f6730f` (including the queued
repaint guard); iOS reused the unchanged native binary from `9076f0c`.
Android's software adapter was explicitly permitted. Its default-policy run
correctly rejected that adapter instead of claiming hardware support. iOS passed
its default capability run. These are Debug simulator observations, not physical
GPU performance or release-consumer results.

## Controlled initialization and disposal checks

`tests/shader-initialization.test.mjs` runs the actual component orchestration
with deferred external promises at device acquisition, atlas creation, shader
compilation, render/compute pipeline creation, native attachment and frame-loop startup. Calling
its effect cleanup twice at each boundary produces no stale ready/error callbacks,
releases each acquired lease/pool once, destroys imported textures and shared
memory once, and removes an attached native layer. It also reproduces the pinned
Worklets deserialization behavior: the activity callback ownership assertion fails
against pre-fix source and passes with the fix.

These controlled tests cover ordering and ownership, not actual driver allocation.

The repeatable runtime controller in
`scripts/acceptance/shader-initialization.js` additionally passed 100 interrupted
initializations on **each** simulator. It intercepts A's existing Debug device-loss
registry registration, after device acquisition and before atlas creation, and
requests A's removal. Each cycle rejects a ready callback for that epoch and
waits for both registry removal and a return to the single B atlas pool before
continuing. B retains its epoch/readiness and advances its clock across the run.
The final acknowledgment requires both maps mounted, both current epochs ready
and two pools. The controller removes its temporary registry override on success
or failure and rejects overlapping runs. It does not force every individual native
driver call to pause; the controlled component tests cover the other async
boundaries separately.

Both simulators then removed both maps (including repeated removal controls),
reached zero atlas pools and no loss-registry entries, and kept probe frame counts
and ready counts unchanged over a further 500 ms. Restoring both maps produced
current-epoch readiness and two pools. Native allocation accounting beyond atlas
counts and the retained idle devices remains separate performance work.

## Repeatable protocol

Select the scenario through `__enhancedMapsScenarios`, then use
`__enhancedMapsShaderLifecycle`. Wait for the requested control values **and**
`snapshot().ready` before taking a baseline; controls update React asynchronously,
so readiness from the previous configuration must not acknowledge a new request.
Snapshots require current shader epochs, native map mount/style acknowledgments,
initialized callback probes and matching native pool counts. Old errors remain
in bounded history but do not poison a restored epoch.

Use `clock(before, after, 'running' | 'paused' | 'background')` for explicit
semantic assertions. A different epoch is a rejected comparison, not time going
backward. For background checks use the trace's background and subsequent active
records, then verify new foreground progress and unchanged ready counts. Launch
the existing app to foreground it; restarting would invalidate the comparison.

Native sampling counters are aggregate. Per-map callback clocks and distinct
visible outputs provide separate evidence; aggregate counters do not establish
per-map sampling totals. Scenario collection reports readiness, not an automatic
pass for every semantic case above. Together with the repeated loss/show-hide and
remount coverage in `shader-lifetime-acceptance.md`, these checks complete GPU-12
within the documented scope. Physical-device follow-up is
maintainer-owned and does not block these implemented checks.
