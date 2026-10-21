# Camera movement provenance

`onCameraIdle` retains its current camera snapshot and now fills `origin` from
native SDK movement reasons and package-owned native commands:

- `gesture`: native gesture evidence, not inferred from coordinate deltas.
- `application`: programmatic/developer camera movement reported by the SDK.
- `sdk`: SDK controls/animations, including an iOS compass reset.
- `unknown`: no recognized reason, including unknown future native reason values.

Android's pinned SDK uses API_ANIMATION (3) for both public Transform commands
and compass reset. Native command generations supplement this ambiguous reason:
package camera commands (including initial setup) claim application ownership;
completion/cancellation clears only the matching command. Native gesture begin
overrides ownership even with JS gesture events disabled. Compass activation is
observed through the native View click accessibility notification, forwarding the
SDK's existing behavior. This signal is delivered even without an accessibility
service and does not replace the SDK click or animation handlers.

Idle consumes the origin and command lease. Explicit commands preserve existing
SDK camera padding and skip exact SDK camera-position no-ops. Late callbacks from
older commands cannot clear a replacement. No origin is inferred from coordinate
deltas. Simulator verification covers animation, immediate movement, exact repeat,
gesture interruption and compass reset during an application animation.

On iOS, the SDK's public `resetNorth` and `resetPosition` operations establish SDK
ownership across their internal programmatic camera callbacks. The existing map
subclass observes these operations while preserving the SDK implementation and
weakly referencing its owner. Native gesture begin or an explicit package command
replaces that ownership. Outside an explicit command call, native gesture flags
take precedence over SDK/reset-north evidence, then programmatic falls back to the
current operation's ownership. Unrecognized reasons remain unknown.

During a synchronous package `setCamera` call, recognized callbacks are attributed
to application: immediate movement and cancellation callbacks can inherit the
compass's stale reset-north flags. The temporary scope ends in `@finally`, and an
SDK-equal no-op returns before claiming ownership. This identifies the operation
causing the callback, not proof that an animation completed. SDK callbacks during
interruption can be intermediate snapshots; the broader idle/completion semantics
remain open under CAM-04/CAM-08.

Simulator verification covers app animation interrupted by compass (final sdk),
compass interrupted by an immediate app command (final application), exact repeat
(no extra event), and pan interruption with JS gesture events disabled (gesture).
Compass/UIControl touches are excluded from package map tap/hold recognition;
compass reset produces no background or feature press.

This does not identify an individual React imperative command, guarantee animation
completion, or implement detailed gesture begin/update/end/cancel callbacks. It
adds no live camera subscription. Standalone native classification/tracker and JS
normalization tests plus SDK builds cover this implementation. Full cancellation,
post-disposal, accessibility activation and rapid replacement matrices remain open
under CAM-08, beyond the verified simulator scenarios.
