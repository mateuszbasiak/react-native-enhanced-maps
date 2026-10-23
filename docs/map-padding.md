# Map viewport padding

`MapView.mapPadding` accepts a uniform number or `{ top, right, bottom, left }`
in logical screen points. It defaults to zero. Edges must be finite, nonnegative
and at most 100000. Updating padding preserves the geographic camera center;
the center projects into the center of the remaining viewport. SDK controls and
attribution follow native ornament placement.

`FitOptions.padding` adds margins to the effective map padding for that fit.
Subsequent `animateCamera` calls use persistent map padding alone. Invalid fit
requests retain the existing camera.

A nonempty viewport too small for requested map padding reports recoverable
`invalid-map-padding` once per request and viewport size. Effective padding is
zero until a later layout or prop update can accommodate the requested edges.
Map readiness and queries remain available. Empty layouts defer application.

The Debug settings example exposes padding, projection, fit and resize probes.
Simulator verification is recorded separately from physical-device release
acceptance, which remains deferred.

## Bounded simulator acceptance

On iPhone 17 Pro / iOS 26.1 Debug, a 402 × 271.33-point viewport with
`{ top: 40, right: 20, bottom: 30, left: 60 }` placed the camera center at
(221, 140.5), within 0.17 point of the expected logical center. Clearing padding
returned it to (201, 135.5). At heading 45° and pitch 40°, a two-coordinate fit
with additional `{ top: 10, right: 15, bottom: 20, left: 25 }` contained both
projected points. A subsequent camera command returned to the persistent center.

Oversized padding reported one error while bounds queries remained available.
Restoring valid padding allowed fitting. Shrinking the viewport below the requested
insets and restoring it reapplied the requested padding without another map-ready
event. An invalid fit rejected without changing the camera. These are bounded
fixtures, not exhaustive animation, lifecycle, geographic or accessibility acceptance.

Android Pixel 9a / API 36 Debug used a 411.43 × 424.76-point viewport. The
same insets placed the center at (226, 217.45), within 0.3 logical points of
the expected center. A camera command after two fits restored exactly that
position. Oversized padding preserved bounds queries; shrink/restore reapplied
the insets with one original readiness event; an invalid fit rejected without
moving the camera. The initial runtime probe exposed SDK transient-padding
leakage, fixed by keeping persistent padding independently of SDK camera state.
