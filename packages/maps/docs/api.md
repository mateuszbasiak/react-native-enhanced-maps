# Public component API

The package root exports `MapView` (also default), `Marker`, `Polyline`, `Polygon`
and `Circle`, plus `validateCamera` and `createRevisionGate`. Public TypeScript
types are exported beside them. Sources, layers and source-oriented cluster
queries are internal infrastructure, not public components. Import experimental
`ShaderLayer` separately from `react-native-maplibre-maps/shaders`.

## MapView

Provide a `styleURL` and a nonzero layout through `style`. Optional `initialCamera`
is mount-only: `{center: {latitude, longitude}, zoom, heading, pitch}`.
`initialRegion` is a mount-only geographic envelope with `latitude`, `longitude`,
`latitudeDelta` and `longitudeDelta`; `initialCamera` takes precedence when both
are supplied. Initial region fitting finishes before `onMapReady`.
Controlled `camera` and `region` props apply changed values without animation;
`camera` takes precedence over `region`. Value-equivalent rerenders and region
callback echoes do not refit. Camera changes are also available through the ref.
See the [migration contract](../../../docs/rn-maps-migration.md) for envelope and
precedence limits. `testID` is passed to the native host. Ordinary map content is
supplied through `children`.

Settings are `scrollEnabled`, `zoomEnabled`, `rotateEnabled`, `pitchEnabled`,
`showsCompass`, `minZoomLevel`, `maxZoomLevel` and `mapPadding`. Gesture/control
flags default true, zoom defaults to [0,24], and padding defaults zero. Padding is
a nonnegative logical-point number or `{top, right, bottom, left}`. Undefined
restores the setting default. Native viewport constraints can clamp camera zoom.

Callbacks are `onMapReady`, `onError`, `onCapabilitiesChange`, `onCameraIdle`,
`onPress`, `onLongPress`, `onGesture`, `onRegionChange` and
`onRegionChangeComplete`. Region callbacks receive `(region, {isGesture})`;
there is no fixed event-rate promise. Map press callbacks receive
`{nativeEvent:{action, coordinate, position}, stopPropagation}`, with logical
map-relative points. `nativeEvent.action` is `press` or `long-press`; legacy
top-level `action` (`tap` or `long-press`), `coordinate` and `position` fields
remain available. Shape callbacks also receive a `nativeEvent` wrapper. Camera idle receives
`{camera, origin}`; origin is `gesture`, `application`, `sdk` or `unknown`.
Gestures receive `{kind, phase, id, timestampMs, position}`. Set
`gestureEventIntervalMs` within 16–1000ms (default 50); begin/end/cancel bypass it.
Errors contain `{code, message, fatal}`.

Foreground location uses `showsUserLocation`, `followsUserLocation`,
`userLocation` and `onUserLocationChange`. An omitted `userLocation` selects the
native foreground watcher; explicit `null` disables it. The application owns
permission requests. Controlled camera/region props take precedence over
following, and map gestures interrupt following until explicitly resumed. See
the [location contract](../../../docs/location-snapshots-dragging.md) for fix
validation, event payloads and lifecycle behavior.

A ready `MapViewRef` supplies:

- `animateCamera(partialCamera, { duration }?)`: sends a command, not an animation-completion
  promise. Duration defaults to 300ms and must be within 0–60000ms; numeric durations remain accepted.
- `getCamera()`: an asynchronous authoritative native camera read.
- `setCamera(partialCamera)`: applies a serialized partial update without animation.
- `animateToRegion(region, duration?)`: fits an envelope; duration defaults to 300ms.
- `pointForCoordinate(coordinate)` and `coordinateForPoint(point)`: asynchronous
  native projection in logical map-relative points.
- `getVisibleBounds()`: asynchronous `{north, south, east, west}` envelope;
  antimeridian bounds can have east less than west.
- `fitCoordinates(coordinates, options?)` and `fitElements(options?)`: asynchronous
  acceptance, not animation completion. Options contain `padding` and `durationMs`.
  `fitElements` also accepts `{edgePadding, animated}` and includes supported
  scene geometry as well as markers.
- `fitToCoordinates(coordinates, {edgePadding, animated}?)` and
  `fitToElements({edgePadding, animated}?)`: RN Maps-style fit aliases.
  `fitToElements` fits markers, including clustered inputs, rather than shapes
  or the user-location dot. See the [fit contract](../../../docs/rn-maps-migration.md).
- `getMapBoundaries()`: the visible envelope as `{northEast, southWest}`.
- `takeSnapshot(options?)`: returns a mounted-viewport PNG/JPEG file URI or raw
  base64 string. Options are `width`, `height`, `format`, `quality` and `result`;
  dimensions are physical pixels. Active shader layers reject. Composition,
  size, retention and iOS pitch/padding limits are defined in the
  [snapshot contract](../../../docs/location-snapshots-dragging.md#snapshots).
- `resumeUserLocationFollow()`: resumes following the latest valid fix, subject
  to controlled camera/region precedence; without a fix it does not move the map.
- `getCapabilities()`: the current frozen report, or null before readiness,
  during style replacement or after disposal/fatal error.

Catch query and command-acceptance promise rejections. `animateCamera` returns
void and reports asynchronous command failures through `onError`. Camera and
geometry commands/queries and snapshots require readiness; style replacement
or disposal invalidates pending queries. Capabilities are evidence states
(`supported`, `unsupported`, `unvalidated`), not a claim that every underlying SDK
feature is available. Current shaders and circle/line/fill quality remain
unvalidated in those reports.

## RN Maps conventions

See the [migration guide](../../../docs/rn-maps-migration.md) for controlled
`region`/`camera`, `initialRegion`, native region-change callbacks, partial camera
updates, RN-style fit/bounds methods, `nativeEvent` press payloads and familiar
component/type aliases. A MapLibre style URL remains required. Legacy helpers
remain available alongside the common RN Maps names.

## Marker and clustering

`Marker` requires a geographic `coordinate`. Use optional `identifier`/`id` or
stable React keys; omitted IDs are generated. Optional `children` override `image`
and the default colored pin. `onPress` receives a marker nativeEvent; `centerOffset`
is supported in logical points. Optional `anchor` defaults to `{x:0.5,y:1}` within [0,1]; logical-point
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
cluster operations. The current participating-marker input bound is 10000. Native marker dragging is supported; callout APIs remain unavailable. See
[location, snapshots and dragging](../../../docs/location-snapshots-dragging.md).

Set `draggable` to enable native long-press dragging. `onDragStart`, `onDrag`,
`onDragEnd` and `onDragCancel` receive `{nativeEvent:{id, coordinate}}`.
Cancellation restores the latest coordinate prop; successful completion retains
the native endpoint until the application changes that value. A draggable marker
must use `cluster={false}` if a cluster group would otherwise enable clustering.
The [dragging contract](../../../docs/location-snapshots-dragging.md#marker-dragging)
defines coordinate echoes, press suppression and lifecycle cancellation.

## Shapes

`Polyline` takes `coordinates`; `Polygon` additionally accepts `holes` and
`fillColor`. `Circle` takes `center`, `radius` in meters and fill/stroke props.
All accept optional `id`, `zIndex`, `visible`, `opacity`, `tappable`, `onPress`,
`strokeColor`, `strokeWidth`, `lineCap`, `lineJoin`, `miterLimit` and
`lineDashPattern`. Polyline additionally accepts `strokeColors`, one color string
per original coordinate; these override `strokeColor` and interpolate along native
Mercator line distance. Gradient plus dash pattern rejects. Polygon/Circle do not
accept `strokeColors`. Polyline/Polygon accept opt-in `geodesic` great-circle edges,
including polygon holes. Use immutable geometry/color arrays and explicit IDs in
changing lists.

The collection supports 64 shapes and 10000 total points, including generated
circle vertices. Coordinates are within ±85° latitude / ±180° longitude. Circle
radius is 0–1000000m; zero radius is invisible. Supported React Native color strings
normalize before transport; dynamic/native color objects are unsupported.

`tappable` defaults false. Shape press receives
`{nativeEvent:{identifier,coordinate,position}}`. Higher shape zIndex draws later;
ties retain declaration order. This is a compatibility subset. See the
[shape contract](https://github.com/mateuszbasiak/react-native-maplibre-maps/blob/main/docs/shapes.md)
for exact geometry, styling and picking limits and current validation results.

## Optional shaders and unavailable APIs

The experimental shader entry requires `react-native-webgpu@0.17.x` and
`react-native-worklets@0.12.2`, Worklets Babel configuration and native rebuilds.
Core components do not require those peers. See the
[shader contract](https://github.com/mateuszbasiak/react-native-maplibre-maps/blob/main/docs/shader-layer.md)
for WGSL, resource, placement, adapter and lifecycle constraints.

User location/following, snapshots and native marker dragging are supported; see
[their contract and limits](../../../docs/location-snapshots-dragging.md). Provider
selection, callouts and public source/layer components are not implemented. Expo
SDK 56 custom native builds use the package config plugin; see
[Expo setup](https://github.com/mateuszbasiak/react-native-maplibre-maps/blob/main/docs/expo.md).
Expo Go is outside the target. Familiar component names do not imply react-native-maps drop-in
compatibility. Legacy React Native architecture is outside the target.
