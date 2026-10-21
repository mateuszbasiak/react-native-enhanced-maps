# Gesture cancellation verification

Goal: verify GEST-02/GEST-06 cancellation and subscription revision behavior on
both running native hosts, preserving the existing public contract.

1. Start held native pan, pinch, rotation and tilt gestures. Background via Home,
   resume via launch, and inspect bounded runtime snapshots. Require one begin
   and one terminal per ID, independent simultaneous kinds and no map errors.
2. Verify a fresh gesture after resume receives a new ID and ends normally.
3. Add a dev-only subscriber cycle control: one bounded pair of timers disables
   at 6 seconds and enables at 10 seconds. Record enabled state and gesture count
   at each transition. Cancel timers on unmount; prevent concurrent cycles.
4. Hold a native gesture across both transitions. Existing recognition must not
   resume delivery after resubscription. A subsequent new gesture must deliver.
   Use native UI actions for input and debugger snapshots only for observation.
5. Run native gate tests, repository checks and production bundles for harness
   changes. Save raw evidence and exact reproduction steps; keep broader
   container, detach/disposal and physical-device gates open.

The timer control avoids second-touch interference from tapping a subscription
button during a gesture. It changes only the dev verification screen. No commits
or publishing; preserve the current shared worktree.
