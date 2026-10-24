# Native shape components

`Polyline`, `Polygon`, and `Circle` are children of `MapView`. They compile to
MapLibre Native layers on iOS and Android, without a React Native view per shape.

```tsx
import { Circle, Polygon, Polyline } from 'react-native-enhanced-maps';

<Circle
  id="search-area"
  center={{ latitude: 54.37, longitude: 18.66 }}
  radius={450}
  fillColor="#16a08540"
  strokeColor="#16a085"
  strokeWidth={3}
  lineDashPattern={[9, 6]}
  tappable
  onPress={({ nativeEvent }) =>
    console.log(nativeEvent.identifier, nativeEvent.coordinate)
  }
/>;
```

Polyline takes `coordinates`. Polygon takes `coordinates` plus optional `holes`;
open polygon rings are closed automatically. Circle takes `center` and `radius`
in meters, using a spherical Earth radius of 6,371,008.8m and a closed 128-segment
approximation. Circle radii are bounded to 0–1,000,000m; a zero radius is invisible.
Circles extending beyond ±85° latitude are rejected. Antimeridian circles use
unwrapped longitudes to retain a short continuous ring.

All three accept `strokeColor`, `strokeWidth`, `opacity`, `visible`, `zIndex`,
`lineCap` (`butt`, `round`, `square`), `lineJoin` (`miter`, `round`, `bevel`),
`miterLimit`, and `lineDashPattern`. Polygon/Circle additionally accept `fillColor`.
Dash arrays contain an even number of positive lengths, measured in logical screen
points; the bridge converts them to MapLibre stroke-width units. Caps/joins default
to round, miter limit to 10. Existing blue stroke/fill and 2-point width defaults
are preserved. Colors accept the pinned React Native color-string forms, including named colors,
short/long hex, `rgb`/`rgba`, `hsl`/`hsla` and `transparent`. Existing #RRGGBB and
#RRGGBBAA strings stay unchanged; other accepted strings normalize to #RRGGBBAA
before native transport. Inputs are limited to 256 characters. Numeric colors,
dynamic/native color objects, `currentColor` and CSS variables are unsupported.
The exact MIT-licensed `@react-native/normalize-colors@0.85.3` helper is an explicit
runtime dependency; it is already part of the pinned RN baseline. This does not
change shader uniform colors or imply full browser CSS Color compatibility.

Higher zIndex draws later within the shape collection; ties retain declaration
order. Explicit `id` is optional; omitted IDs use shape declaration order. Give
changing lists explicit stable IDs. Geometry arrays are immutable. The collection
is bounded to 64 shapes and 10,000 total points, including generated circle points.

`tappable` defaults to false. With `tappable` and `onPress`, a native hit dispatches
`{nativeEvent: {identifier, coordinate: {latitude, longitude}, position: {x, y}}}`.
The position is relative to the map in logical screen points. The topmost rendered
interactive layer wins; noninteractive layers let picks reach layers below them.
Polygon holes are excluded by native geometry filtering after the rendered-feature
query, preserving lower-layer and map fall-through. See [polygon-hole picking](polygon-hole-picking.md). Marker views
remain a separate input/ordering system.

This is a compatibility subset, not drop-in react-native-maps parity. Geodesic
polylines/polygons, per-vertex strokeColors and lineDashPhase remain unsupported
and rejected rather than silently ignored. Native geographic edge behavior and
press semantics have separate validation coverage; physical-device checks are
maintainer-owned follow-up. Build/contract checks do not establish visual parity
or production performance.

The example's “Show native layers” screen includes all three shapes and displays
the selected shape identifier after a press.

Shapes also contribute to the shared [scene input budgets](scene-budgets.md),
including generated circle points and repeated fill/stroke references.

## Color-string verification, 2026-10-24

The shared compiler contracts cover named colors, short hex, rgba/hsl,
transparent, invalid inputs and preservation of existing long-hex signatures
across Polyline/Polygon/Circle. Full local CI passes 84 contracts, declarations,
Codegen, packed-package checks and both production bundles.

Debug smoke on iPhone 17 Pro / iOS 26.1 and a temporary Pixel 9a ARM64 / API 36
emulator rendered the example's RGB route, translucent RGBA circle and named-color
stroke. Pressing the circle reported `selected harbor-circle` on both hosts.
These used the existing main-based native Debug binaries because color parsing
changes only JavaScript and the native scene representation stays unchanged.

The original Android AVD could not install the APK because storage was full.
A new session-owned AVD with fresh storage passed installation and runtime checks;
no existing application data was deleted. This is simulator evidence, with
physical-device testing deferred to the maintainer.
