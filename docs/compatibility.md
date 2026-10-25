# Compatibility

Current renderer: package-owned MapLibre Native on iOS and Android, with Fabric
components exported by `react-native-enhanced-maps`. Google Maps and Apple Maps
experiments have been removed; provider selection is not a public API.

The supported development baseline is React Native 0.85.3 / React 19.2.3,
iOS 16+ and Android 24+, MapLibre iOS 6.31.0 and Android OpenGL 13.6.1. This records
the pinned integration, not tested runtime coverage on every minimum-OS device.
Core packed consumers have Debug/Release build and Release simulator evidence in
[native consumers](native-consumers.md). Physical-device validation is
maintainer-owned deferred follow-up, not a feature-completion prerequisite.

The current [public API reference](../packages/maps/docs/api.md) documents
MapView, React-child Marker, Polyline, Polygon, Circle, camera/query refs, native
settings/events and component clustering. Clustering is implemented and has
[component acceptance evidence](component-cluster-acceptance.md). Experimental
[ShaderLayer](shader-layer.md) is implemented through the separate `/shaders`
entry with optional WebGPU/Worklets peers; it is not a validated production GPU
performance claim.

The package does not claim react-native-maps drop-in compatibility. Provider
selection, controlled camera, marker dragging/callouts, user location/tracking,
snapshots are not implemented. [Expo SDK 56 custom builds](expo.md) have core
consumer build/simulator acceptance; Expo Go is outside the target. Public source/layer components
and their old cluster-query APIs were retired. Symbol/icon, raster/tile, heatmap
and expression/filter requirements still need reconciliation with the component
API. Complete RNGH/input, accessibility, lifecycle and spatial-parity matrices
remain checklist work.

Older prototype and source/layer documents are historical/internal descriptions,
not alternate public API specifications. The pinned source comparison and compile-checked migration guidance below cover
part of COMPAT-01–02/05–06/08–09; equivalent runtime parity fixtures remain open.

## Pinned React Native Maps comparison

This source/API audit compares `react-native-maps@1.26.20`, tag commit
[`988a51ea84a0145dc8d8019680ce4133bbcbb29d`](https://github.com/react-native-maps/react-native-maps/tree/988a51ea84a0145dc8d8019680ce4133bbcbb29d),
with this package's exported declarations. The upstream sources are
[MapView](https://github.com/react-native-maps/react-native-maps/blob/988a51ea84a0145dc8d8019680ce4133bbcbb29d/src/MapView.tsx),
[Marker](https://github.com/react-native-maps/react-native-maps/blob/988a51ea84a0145dc8d8019680ce4133bbcbb29d/src/MapMarker.tsx),
and [Polyline](https://github.com/react-native-maps/react-native-maps/blob/988a51ea84a0145dc8d8019680ce4133bbcbb29d/src/MapPolyline.tsx),
[Polygon](https://github.com/react-native-maps/react-native-maps/blob/988a51ea84a0145dc8d8019680ce4133bbcbb29d/src/MapPolygon.tsx),
[Circle](https://github.com/react-native-maps/react-native-maps/blob/988a51ea84a0145dc8d8019680ce4133bbcbb29d/src/MapCircle.tsx).
This pin is a comparison reference, not a runtime dependency or a claim that RN
Maps was built or run on this package's RN baseline. No equivalent RN Maps
simulator or performance comparison was performed for this audit.

**Supported** below means the named input exists in the current public contract.
**Partial** means application changes are required or behavior differs.
**Unsupported** means no public implementation exists. Even supported names do
not promise provider-identical pixels, timing, hit order or accessibility.

### Map configuration and events

- **Supported subset:** `style`, `testID`, `scrollEnabled`, `zoomEnabled`,
  `rotateEnabled`, `pitchEnabled`, `showsCompass`, `minZoomLevel`, `maxZoomLevel`
  and four-edge `mapPadding`. This package also accepts uniform numeric padding.
  Zoom limits use the portable 0–24 interval; SDK constraints can clamp further.
- **Partial initial camera:** `initialCamera` is mount-only, but requires
  `{center, zoom, heading, pitch}`. RN Maps uses `pitch`, `heading`, `center` and
  provider-dependent `zoom`/`altitude`. There is no altitude conversion here.
  `region`, `initialRegion` and controlled `camera` are unsupported. Do not
  convert latitude/longitude deltas to a fixed zoom without viewport/projection
  calculations; use an explicit camera or fit coordinates after readiness.
- **Partial basemap selection:** provide a required MapLibre `styleURL` and own
  any style/tile credentials and attribution obligations. RN Maps `provider`,
  `mapType`, `googleMapId` and `customMapStyle` are unsupported; a Google style
  array is not a MapLibre style document.
- **Partial events:** `onMapReady` has no event argument. `onPress` and
  `onLongPress` receive `{action, coordinate, position}` directly, without
  `nativeEvent`. Map `onPress` represents an unclaimed background tap, not a
  generic marker/shape press. `onCameraIdle` receives `{camera, origin}`;
  it is not a rename of `onRegionChangeComplete(region, details)` or proof that
  an animation completed. `onGesture` is this package's separate native gesture
  stream. See [camera origins](camera-origins.md) and [map presses](map-presses.md).
- **Unsupported:** region-change callbacks, `onPanDrag`, POI/indoor/KML and
  marker-selection callbacks on MapView; user location/tracking and permission
  handling; traffic/building/indoor/scale/location-button controls, map toolbar,
  provider-specific zoom controls, loading/cache/lite modes, `AnimatedRegion`
  and `MapView.Animated`. MapView accepts the documented subset rather than all
  React Native View props. Use an outer View for unrelated layout/input needs.

### Camera and query refs

- **Partial `animateCamera`:** supply the complete camera and optionally a numeric duration:
  `map.animateCamera(camera, 300)`. RN Maps accepts a partial camera and an options
  object. This method returns void, rejects invalid/not-ready use by throwing,
  and does not report animation completion. There is no `getCamera`, `setCamera`,
  `animateToRegion`, `setRegion` or controlled-camera feedback-loop contract.
- **Partial fitting:** replace `fitToCoordinates(points, {edgePadding, animated})`
  with `fitCoordinates(points, {padding, durationMs})`. Replace `fitToElements`
  with `fitElements`; element inclusion follows this package's accepted geometry
  and markers, not RN Maps provider rules. Use `durationMs: 0` for an immediate
  fit. Fit promises resolve on native command acceptance, not the final frame.
  Queries/fits reject before readiness or when their owning style/map lifecycle becomes stale.
  See [geometry and fitting](map-geometry.md) for bounds and lifecycle limits.
- **Supported signatures:** `pointForCoordinate` and `coordinateForPoint` return
  promises with numeric coordinate/point objects. Values use map-relative logical
  points. Signature similarity does not establish cross-provider pixel parity.
- **Partial bounds:** use `getVisibleBounds()` returning
  `{north, south, east, west}` instead of RN Maps `getMapBoundaries()` returning
  `{northEast, southWest}`. Preserve `east < west` for antimeridian envelopes.
- **Unsupported:** `fitToSuppliedMarkers`, `setMapBoundaries`, snapshots,
  `addressForCoordinate`, `getMarkersFrames`, `boundingBoxForRegion`, indoor-level
  commands and imperative `setNativeProps`. No exported Callout, Overlay,
  Geojson, Heatmap, LocalTile, UrlTile or WMSTile counterpart exists.

### Markers, shapes and clustering

- **Partial Marker:** `coordinate`, normalized `anchor`, numeric `zIndex` and
  React children exist. Supply a required stable string `id` and explicit child
  content; RN Maps `identifier` is not an alias. `offset` is the package's explicit
  logical-point offset, not a supported `centerOffset` prop. Handle presses in
  child Pressable components. Android renders marker visuals into the map while
  retaining native child input; do not assume identical RN Maps view snapshots,
  arbitrary transforms, selection or overlap semantics. See [marker sync](marker-coordinate-sync.md).
- **Unsupported Marker APIs:** default platform pins, `image`/`icon`/`pinColor`
  props, titles/descriptions/callouts, dragging, marker refs/animation commands,
  `tracksViewChanges`, `flat`, `rotation`, selection and marker-level `onPress`.
  An application can supply its own Image child, but that does not implement
  RN Maps image-marker or callout behavior.
- **Supported shape subset:** Polyline/Polygon `coordinates`, Polygon `holes`,
  Circle `center`/meter `radius`, string stroke/fill colors where applicable,
  `strokeWidth`, `zIndex`, cap/join/miter and dash-pattern props. Polyline/Polygon
  support `geodesic`; Polyline supports per-vertex `strokeColors`. This package
  adds `visible` and `opacity`. Numeric/dynamic color objects and `lineDashPhase`
  are unsupported. Gradients cannot be combined with dash patterns. Geometry,
  colors, circle approximation, point/shape limits and dash units follow
  [the shape contract](shapes.md), not provider defaults.
- **Partial shape interaction/order:** opt into `tappable` and `onPress`; read
  `event.nativeEvent.identifier`, `coordinate` and `position`. The wrapper differs
  from map presses. IDs are optional for shapes, but stable IDs are recommended
  for changing lists. Shapes are descriptors consumed by MapView, with no shape
  refs or `setNativeProps`. Shape zIndex order and native marker order are separate
  systems; cross-content hit/draw parity remains unverified.
- **Package-specific clustering:** opt markers in with `cluster`, optionally
  partition with `clusterGroup`, and supply `clusterComponent` on MapView when
  needed. `getMembers`/`expand` belong to cluster-component props and can reject
  obsolete selections. This is not an RN Maps clustering API or a public
  source/layer query API. See [component clustering](clustering.md).

### Migration example and verification

The complete [compiler fixture](../packages/maps/type-tests/rn-maps-migration.tsx)
shows map/marker/shape migration, child presses, camera commands, fits and queries.
For an existing RN Maps screen:

1. Replace the import with this package's default MapView and named components.
2. Replace provider/map-type configuration with a valid `styleURL` and a complete
   `initialCamera`; preserve the original layout style.
3. Give each marker a stable `id` and child visual/input component.
4. Rewrite event handlers for the appropriate direct or `nativeEvent` payload.
5. Issue ref commands after readiness and explicitly handle async rejections.
   A `.then()` on a fit is not an animation-finished signal.

The fixture's example style URL is a placeholder; use an accessible real style
before running it. `npm run typecheck` checks the fixture against source exports;
`npm run pack:check` checks the same fixture against packed public declarations.
Negative compiler assertions cover controlled region, dragging, missing marker
identity/content, partial cameras, RN Maps duration options, old fit names,
snapshots, camera getters, event wrappers and dash phase.

These checks establish declaration-level migration guidance only. Equivalent
cross-library visual/interaction fixtures, accessibility acceptance, broader
lifecycle coverage and release-device measurements remain separate checklist
work. The pin and documentation slice of COMPAT-01–02/05–06/08–09 is implemented;
the grouped checklist item stays open until the remaining acceptance is complete.
