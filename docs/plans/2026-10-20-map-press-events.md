# Map press callbacks

**Goal:** Add GEST-04's public map tap/long-press callbacks and verify arbitration
with feature selection, double-tap/quick zoom and marker children.

**Design:** MapView.onPress receives confirmed single taps that hit no interactive
feature; MapView.onLongPress receives a native stationary long press anywhere on
the map, including features. Both receive an action, geographic tap coordinate
and map-relative logical-point position. Feature taps retain source callbacks and
do not also clear selection through the background callback. Marker child touches
never reach either map callback. Double taps/quick zoom remain SDK camera actions.

Android uses its public confirmed map-click/long-click listeners. iOS reuses the
confirmed feature tap and existing long-hold exclusion recognizer (began only).
No event payload is built without a subscriber. Ready style revisions and JS
readiness reject loading/obsolete events. Validate finite coordinates and positions
at the JS boundary. Callback subscription does not change SDK recognition.

Alternatives: bubbling feature taps to onPress makes background deselection race
selection; a JS responder wrapper competes with native map gestures. A double-tap
callback is unnecessary to preserve SDK zoom and is outside this API addition.

**Steps:**

1. Add failing malformed-event/action parser tests and public type cases.
2. Add typed callbacks and Codegen event/enable prop; wire both native hosts.
3. Record bounded map-press evidence in the development verification screen.
4. Run checks, Codegen, bundles and native builds; install and verify background
   tap, feature tap, long hold, double tap and subscriber removal on both simulators.
5. Request read-only review, update contract/checklist and preserve broader gates.

This follows the standing user authorization to choose and complete checklist work.
