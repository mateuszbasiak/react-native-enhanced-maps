# Native gesture lifecycle events

**Goal:** Implement GEST-01/02/03/06's native continuous gesture recognition path on package-owned MapLibre hosts, with explicit subscriber bounds and cancellation semantics.

**Design:** Add `onGesture` and `gestureEventIntervalMs` (default 50ms, range 16–1000ms) to MapView. Events contain native kind (`pan`, `zoom`, `rotate`, `tilt`), phase (`begin`, `update`, `end`, `cancel`), per-map sequence ID, monotonic native timestamp in milliseconds and map-relative logical-point focal position. Zoom includes pinch and native continuous quick-zoom, rather than guessing finger count from camera movement. Kinds may run simultaneously with independent IDs; events are not an exclusive camera-ownership claim. Discrete tap/long-press/double-tap remain GEST-04 work.

Android uses SDK move/scale/rotate/shove listener interfaces and their focal points. MotionEvent CANCEL, late marker ownership, pause and detach cancel active streams before SDK terminal callbacks can mislabel them as ended. iOS adds observer targets to the map's existing public UIKit recognizers, preserving SDK handlers; pan min-touch counts distinguish native pan/tilt, pinch/quick-zoom report zoom, rotation reports rotate. Cancelled/failed UIKit states cancel active streams. Existing SDK recognizers with nil delegates are given the map's marker-aware delegate; no private SDK view hierarchy or camera-delta inference is used.

Equivalent bounded Java/C++ gates track at most four active kinds. They emit begin once, throttle updates per kind, always emit terminal events for tracked begins and retain the latest focal point for cancellation. Subscription removal resets state without replay; a new subscriber starts only at a later native begin. A native/JS subscription revision drops queued events from earlier subscriptions. Payloads are constructed only when emission is accepted. Gesture events must not be transport-coalesced across phases.

**Alternatives:** Camera snapshots cannot identify gestures reliably. A JS responder wrapper would miss native beginnings and require application glue. A standalone recognizer set would compete with the SDK; observing existing native recognition preserves its interaction rules.

## Implementation plan

1. Add failing Java/C++ gate regressions for begin/update/terminal bounds, simultaneous kinds, cancellation/reset, unsubscribed delivery, latest focal points and invalid inputs. Add JS interval/payload parser tests and public type tests.
2. Implement gates and typed JS contracts/normalization; wire Codegen props/event and subscriber revision in MapView.
3. Integrate native SDK/recognizer observers, lifecycle cancellations, noncoalesced delivery and marker-aware iOS delegates. Change detailedGestures capability from unsupported to unvalidated.
4. Regenerate Pods/Codegen, run targeted/full checks, bundles and native SDK builds. Request read-only review and address actionable findings. Update checklist/contracts/evidence. User has now authorized the running iOS simulator and Android emulator for verification. Exercise runtime multi-touch, marker input, event delivery, source/style reload and lifecycle scenarios; keep physical-device and release-performance gates separate.
