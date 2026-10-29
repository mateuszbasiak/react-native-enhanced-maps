# Android cluster layout scheduling

Android previously posted one layout callback for every fully rendered frame,
even when another callback was still waiting in the UI queue. Each map now owns
one cancellable job. Repeated frame notifications coalesce while it is pending;
execution reads current map/style/source/viewport state. The existing structured
layout comparison still avoids emitting identical layouts to JavaScript.

Host pause or window detach removes the pending callback. Resume requests a fresh
layout while the map is running and its style is ready; subsequent full frames
continue to update it. Disposal permanently closes the scheduler. Callback identity
checks prevent an already delivered cancelled callback from consuming a newer job.
A failed enqueue clears pending state so later updates can retry.

This changes scheduling only. It neither truncates visible markers nor introduces
a marker-count cap. Existing scene byte/position limits, spatial query margin,
world-copy deduplication and 100-member query pages remain in force. The helper is
UI-thread confined, matching the map host's lifecycle and render notifications.

## Verification on 2026-10-29

The Java helper regression harness covers 1000 notifications yielding one queued
job and the latest state; cancellation followed by a stale callback; independent
map queues; 100 cancellation/reactivation cycles; terminal disposal; rejected and
throwing enqueue operations; and a subsequent update requested during work.
The Node harness compiles and runs those Java tests. The repository check passes
364 tests, TypeScript, lint/format, Codegen and packed-package checks.

The Android ARM64 Debug build passes using the dedicated validation checkout:

```sh
npm run build:android -- -PreactNativeArchitectures=arm64-v8a -PreactNativeDevServerPort=8094 -PverificationApplicationIdSuffix=.clusters
METRO_PORT=8094 node scripts/check-rn-maps-runtime.mjs --clusters <logical-device-id>
```

Small_Phone / Android 17 API 37 runs the isolated `.clusters` app. All seven strict
native cases pass: four spatial islands, east/west dateline, wrapped world copies,
dateline groups, style replacement and remount. Each transition requires three
matching observations and exact membership/metadata checks. The final grouped
fixture has counts 2/4/4/2 and all twelve member IDs. After sending the app Home and
bringing the same activity back, exact cluster partitions, coordinates, member IDs
and metadata match the pre-background observation.

Ignored receipts are `artifacts/verification/cluster-scheduling/spatial-android.json`
and `background-resume.json`. The emulator is a 16 KB target; this independent
scheduling branch uses the existing app's compatibility mode and makes no binary
alignment claim. Shader alignment is handled separately. No iOS behavior changes;
its publication remains synchronous in the native frame callback.

## Remaining CLUSTER-06 work

The tests prove the scheduler's queue bound and functional integration, not SDK
index memory, physical-device performance, native allocation accounting or the
complete in-flight/background cancellation matrix. The 100-cycle helper test is
not a claim of 100 native application lifecycle cycles. Visible output and index
resource bounds remain open; these results do not close CLUSTER-06.
