# Public component API

The package root exports `MapView` (also default), `Marker`, `Polyline`, `Polygon`
and `Circle`, plus `validateCamera` and `createRevisionGate`. Public TypeScript
types are exported beside them. Sources, layers and source-oriented cluster
queries are internal infrastructure, not public components. Import experimental
`ShaderLayer` separately from `react-native-enhanced-maps/shaders`.

## MapView

Provide a `styleURL` and a nonzero layout through `style`. Optional `initialCamera`
is mount-only: `{center: {latitude, longitude}, zoom, heading, pitch}`. Camera
changes use the ref; there is no controlled region/camera prop. `testID` is passed
to the native host. Ordinary map content is supplied through `children`.

Settings are `scrollEnabled`, `zoomEnabled`, `rotateEnabled`, `pitchEnabled`,
`showsCompass`, `minZoomLevel`, `maxZoomLevel` and `mapPadding`. Gesture/control
flags default true, zoom defaults to [0,24], and padding defaults zero. Padding is
a nonnegative logical-point number or `{top, right, bottom, left}`. Undefined
restores the setting default. Native viewport constraints can clamp camera zoom.

Callbacks are `onMapReady`, `onError`, `onCapabilitiesChange`, `onCameraIdle`,
`onPress`, `onLongPress` and `onGesture`. Map press callbacks receive
`{action, coordinate, position}` directly, with logical map-relative points.
Shape callbacks instead receive a `nativeEvent` wrapper. Camera idle receives
`{camera, origin}`; origin is `gesture`, `application`, `sdk` or `unknown`.
Gestures receive `{kind, phase, id, timestampMs, position}`. Set
`gestureEventIntervalMs` within 16–1000ms (default 50); begin/end/cancel bypass it.
Errors contain `{code, message, fatal}`.

A ready `MapViewRef` supplies:

- `animateCamera(camera, durationMs?)`: sends a command, not an animation-completion
  promise. Duration defaults to 300ms and must be finite and nonnegative.
- `pointForCoordinate(coordinate)` and `coordinateForPoint(point)`: asynchronous
  native projection in logical map-relative points.
- `getVisibleBounds()`: asynchronous `{north, south, east, west}` envelope;
  antimeridian bounds can have east less than west.
- `fitCoordinates(coordinates, options?)` and `fitElements(options?)`: asynchronous
  acceptance, not animation completion. Options contain `padding` and `durationMs`.
- `getCapabilities()`: the current frozen report, or null before readiness,
  during style replacement or after disposal/fatal error.

Catch query rejections. Commands and queries require readiness; style replacement
or disposal invalidates pending queries. Capabilities are evidence states
(`supported`, `unsupported`, `unvalidated`), not a claim that every underlying SDK
feature is available. Current shaders and circle/line/fill quality remain
unvalidated in those reports.

## Marker and clustering

`Marker` requires a stable `id`, geographic `coordinate` and React Native
`children`. Optional `anchor` defaults to `{x:0.5,y:1}` within [0,1]; logical-point
`offset` defaults to zero. `zIndex` defaults to zero; larger values win, ties use
marker creation order. Use ordinary React Native child input handlers.
Marker and shape ordering remain separate native systems.

Opt into clustering with `cluster` or `clusterGroup`. Optional application-owned `data` is returned
lazily by `getMembers()` and remains in JavaScript. `MapView.clusterComponent`
receives `{count, coordinate, clusterGroup, getMembers, expand}`. The default count bubble expands
on press. Membership and expansion reject after index/style/map replacement.
Optional `clusterGroup` restricts clustering to participating markers with the
same exact string and enables clustering unless `cluster={false}` explicitly
overrides it. `cluster={true}` without a group uses the default group. Omitting
both props keeps a marker independent. Names must be nonblank and at most 512
characters. Custom cluster components receive `clusterGroup`, undefined for the
default group. Each group uses one source/layer within shared scene limits of
64 sources and 128 layers. Different groups can overlap visually; distance and
zoom still control clustering within each group. Changing groups invalidates old
cluster operations. The current participating-marker input bound is 10000. Dedicated marker image,
dragging and callout APIs are not implemented.

## Shapes

`Polyline` takes `coordinates`; `Polygon` additionally accepts `holes` and
`fillColor`. `Circle` takes `center`, `radius` in meters and fill/stroke props.
All accept optional `id`, `zIndex`, `visible`, `opacity`, `tappable`, `onPress`,
`strokeColor`, `strokeWidth`, `lineCap`, `lineJoin`, `miterLimit` and
`lineDashPattern`. Use immutable geometry arrays and explicit IDs in changing lists.

The collection supports 64 shapes and 10000 total points, including generated
circle vertices. Coordinates are within ±85° latitude / ±180° longitude. Circle
radius is 0–1000000m; zero radius is invisible. Supported React Native color strings
normalize before transport; dynamic/native color objects are unsupported.

`tappable` defaults false. Shape press receives
`{nativeEvent:{identifier,coordinate,position}}`. Higher shape zIndex draws later;
ties retain declaration order. This is a compatibility subset. See the
[shape contract](https://github.com/mateuszbasiak/react-native-enhanced-maps/blob/main/docs/shapes.md)
for exact geometry, styling and picking limits and current validation results.

## Optional shaders and unavailable APIs

The experimental shader entry requires `react-native-webgpu@0.17.x` and
`react-native-worklets@0.12.2`, Worklets Babel configuration and native rebuilds.
Core components do not require those peers. See the
[shader contract](https://github.com/mateuszbasiak/react-native-enhanced-maps/blob/main/docs/shader-layer.md)
for WGSL, resource, placement, adapter and lifecycle constraints.

Provider selection, user-location/tracking/permission ownership, snapshots,
controlled camera, public source/layer components and Expo integration are not
implemented. Familiar component names do not imply react-native-maps drop-in
compatibility. Legacy React Native architecture is outside the target.
