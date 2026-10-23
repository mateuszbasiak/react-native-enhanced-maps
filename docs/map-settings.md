# Map interaction settings

`MapView` accepts `scrollEnabled`, `zoomEnabled`, `rotateEnabled`, `pitchEnabled`
and `showsCompass`. All default to true and can change after mount. They configure
the SDK recognizers/compass; event subscription via `onGesture` is independent.
Disabling gestures does not disable camera commands, fitting or marker children.
`zoomEnabled` includes pinch, double-tap and quick zoom. The compass follows the
SDK's normal north-facing fade behavior when enabled.

`minZoomLevel` and `maxZoomLevel` define an inclusive interval in [0,24], defaulting
to [0,24]. Equal endpoints are allowed. Inputs must be finite numbers in order;
invalid updates reject in JS before native props change. Both hosts defensively
reject malformed native intervals. Replacing disjoint intervals widens the SDK
limits before applying the new pair, avoiding an intermediate inverted interval.
SDK viewport/geographic constraints can still impose a narrower zoom range.

The package now explicitly applies maximum zoom 24 to match its camera-input
range. iOS previously inherited the SDK's default maximum 22. Camera commands and
fit operations are subject to the configured limits; accepted commands do not
promise an unclamped target or animation completion.

```tsx
<MapView
  styleURL={styleURL}
  scrollEnabled={false}
  rotateEnabled={false}
  minZoomLevel={4}
  maxZoomLevel={16}
/>
```

Reset an optional prop to undefined to restore its package default. These settings
survive style replacement because they belong to the map host. They do not provide
a controlled camera, provider switching, user tracking, location permissions,
attribution hiding or every react-native-maps control. Persistent map padding is
separate remaining work; per-fit padding is already available. Changes during an
active multi-touch sequence and accessibility actions need additional acceptance.

The example's Debug-only “Open settings” screen exercises toggles, disjoint zoom
ranges and out-of-range camera requests. Contract and type tests cover validation;
native builds and simulator results must be recorded separately.

## Bounded verification — 2026-10-23

Both native Debug app builds passed; package CI passed 80 tests, types, quality,
Codegen, packed declarations and both production bundles. On Android API 36 and
iPhone 17 Pro/iOS 26.1 simulators, a zoom-20 request under [10,12] yielded 12;
a zoom-1 request after switching to [2,4] yielded 2. Android disabled pan, pinch,
rotation and two-finger tilt preserved queried native bounds to 1e-7 degrees;
restoring defaults re-enabled pan with gesture-origin idle. Camera commands still
worked with gestures disabled.

The first iOS compass-hide check removed the visual compass but left its AX entry.
An explicit accessibility hide adjustment was added and rebuilt successfully. Its
runtime retest, full iOS disabled-gesture checks, equal-endpoint native behavior
and remaining gesture-restoration cases are pending: the simulator approval
service hit its usage limit before those actions ran. Do not infer those passes
from the compiled code or earlier observations. Local bounded observations are in
`artifacts/verification/map-settings-2026-10-23.json` (generated, not packaged).
Physical-device testing remains deferred to the maintainer.
