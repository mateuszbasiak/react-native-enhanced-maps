# Marker child touch ownership

Touches targeting a marker's React Native child content are reserved for that
content from their start. This avoids waiting for the JS responder grant while the
map's native recognizer can already begin. Child `Pressable`, `PanResponder` and
native input dispatch keep their ordinary APIs. Set `pointerEvents="none"` on
purely decorative content, or `box-none` on containers, to let untargeted regions
reach the map. A default touchable View may reserve a region even without a JS
handler; the package does not guess which JS handlers will later accept a touch.

Android resolves the initial target through React Native's pointer-event-aware
hit-test path after refreshing marker input bounds/order. A marker-target stream
never enters the SDK touch handler. A later disallow-intercept claim cancels the
SDK stream once. Ownership is sticky through child release or marker removal,
until the stream ends with UP/CANCEL; detach and map disposal also reset it. A new
DOWN recovers an interrupted stream. Native child dispatch continues normally.

On iOS, UIKit assigns the initial hit-tested view, and SDK recognizers decline
receipt of touches targeting a package annotation descendant. The package feature
picker declines them too, so a marker tap does not also select a layer underneath.
UIKit retains stream ownership through release, cancellation or view removal.
Touches that begin on the background retain normal SDK behavior. This does not
cancel an already running camera animation or inertia.

The Android ownership gate has executable standalone tests. Both platforms compile
against their native SDKs. Native gesture routing, multi-touch, transformed/overlapping
children, child removal during a drag, RNGH and navigation interactions still
require runtime verification. This is a bounded
implementation of GEST-05, not closure of that entire integration workstream.

Running iOS/Android simulators passed child counter taps, long presses and slider
drags on 2026-10-20; the map did not move during these child interactions.
Overlapping input followed zIndex changes and later mount order for equal values.
iOS annotation wrappers are accessibility containers rather than SDK callout
leaves, allowing React children to retain their labels/actions. Their accessibility
frames use screen coordinates. Native tree checks passed before/after camera pan
and remount. Full assistive-technology navigation remains an open quality gate.

## Supported integration scope

The package owns touch routing between the map and its markers. Gesture coordination
with nested scroll views and bottom-sheet containers is outside the supported
scope. Applications may compose their own layouts, but the package does not promise
responder handover or simultaneous gestures with those containers.

## Marker accessibility

`Marker` accepts React Native `accessible`, `accessibilityLabel`,
`accessibilityHint`, `accessibilityRole`, `accessibilityState`,
`accessibilityActions` and `onAccessibilityAction` props. Marker-level semantics
are placed on one target: the marker Pressable when it handles presses, selection
or a callout, otherwise the content wrapper. Selection-only markers do not expose
an additional labelled wrapper.

Custom child controls retain their own accessibility by default. Use an explicit
marker label or `accessible={true}` to group a custom pin into one target; use
`accessible={false}` to preserve child traversal instead. Interactive pins default
to the button role. Default static pins expose a “Map marker” label; applications
should supply meaningful labels. Hints, custom actions and state go to the same
target. Custom actions call the supplied handler; applications own their behavior.
React Native state descriptions such as `disabled` do not themselves disable
marker interaction. Callout `expanded` always reflects actual visibility and
cannot be overridden by caller state. Other state fields are preserved.

Automated contracts cover target selection, opt-in grouping/opt-out, hint/action
forwarding and callout expansion. Native ownership regressions cover independent
map streams, cancellation and late grants; drag regressions cover one cleanup
cancellation, stale events and a subsequent valid session. These checks do not
establish multi-touch runtime behavior, visual texture alignment or VoiceOver/
TalkBack acceptance. Those remain separately tracked follow-up.
