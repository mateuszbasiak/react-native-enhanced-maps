# Native continuous gesture events

Pass `onGesture` to `MapView` to observe native `pan`, `zoom`, `rotate` and
`tilt` recognition. Zoom includes pinch and continuous quick zoom. Discrete taps
and long presses are separate interaction work.

Each event contains `kind`, `phase` (`begin`, `update`, `end`, `cancel`), a
per-map positive sequence `id`, monotonic native `timestampMs`, and a focal
`position` in map-relative logical points. Native timestamps are suitable for
intervals within a map session, not wall-clock dates or cross-device comparison.
Kinds may overlap with independent IDs according to the SDK's recognition rules.
These events do not promise exclusive camera ownership.

`gestureEventIntervalMs` defaults to 50 and accepts finite values from 16 through 1000. Updates are throttled independently per kind. Begin and terminal phases
bypass throttling, and native transport does not coalesce lifecycle phases.
The gates retain the latest focal point even when an update is throttled.

Removing the subscriber clears active delivery. Re-enabling it waits for a new
native begin; it does not replay an existing gesture. Subscription revisions
discard queued samples from an earlier subscription. At most four kinds are
tracked, and event payloads are built only for accepted emissions.

Android observes public MapLibre move/scale/rotate/shove listeners. iOS observes
the map's existing public UIKit recognizers while preserving SDK handlers and
delegates. Native cancellation, backgrounding, detach and marker ownership cancel
tracked streams. Disposal clears state. No camera-delta inference or private SDK
view inspection is used.

Both running simulators delivered all four kinds with begin/update/end and native
gesture camera provenance on 2026-10-20. One-finger quick zoom also delivered zoom
begin/update/end with camera movement on both simulators and no feature presses.
iOS subscriber removal and a 250 ms
interval passed runtime checks. Android rotation overlapped pan with separate IDs.
Slow pinches can remain below MapLibre Android's recognition threshold; a wider,
faster pinch produced zoom and camera movement.

On 2026-10-21 both simulators passed Home/background cancellation for held pan,
zoom, rotation and tilt. Each begun ID had exactly one terminal; simultaneous
kinds cancelled independently. A fresh pan after resume began with a new ID and
ended normally. A held pan across subscriber removal and restoration delivered
no further samples or terminal after removal; a subsequent new pan delivered
normally. The dev verification screen's Cycle subscriber control removes at
6 seconds and restores at 10 seconds, recording event counts at each transition.
Both counts stayed at one during the held-pan scenario on each platform.
The 250ms interval also passed on both: iOS update gaps were 283–300ms and
Android gaps 279–304ms. Android end arrived 120ms after its last update,
confirming terminal delivery bypasses the update interval.

Full interruption, detach/disposal,
navigation/container and physical-device coverage remain open, so the runtime
capability stays `unvalidated`. See [runtime evidence](verification.md).
