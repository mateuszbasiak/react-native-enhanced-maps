# Changelog

No public package release has been published. Entries below describe development
changes, not accepted production support or closed release gates.

## Unreleased

- Stage native Overlay image loading and decoding off the UI thread before scene
  replacement. Preserve accepted images, fitting and hit geometry on failure;
  cancel obsolete/lifecycle work and retry after resume. Downsample to queried
  renderer/platform texture capabilities, with allocation-failure fallback.
  Remove unmeasured image-count and URI-length caps without adding byte quotas.

- Add `UrlTile.flipY` for native TMS row addressing on both hosts, with XYZ
  unchanged by default and shared native input validation.

- Remove fixed scene/source/content byte caps and Geojson, heatmap, cluster-group
  and camera-fit dataset count caps, including polygon holes and per-vertex line
  gradient stops. Large cluster layouts and feature-hit
  properties retain interaction delivery. Property complexity guards apply per
  feature; geometry/style validation, cluster query bounds
  and snapshot/GPU allocation limits remain.

- Batch native Polyline/Polygon/Circle components into shared sources and
  per-feature paint layers, including differing colors, widths and opacity.
  At equal zIndex fills draw below outlines; incompatible layout/dash/gradient
  settings retain ordered stroke runs. Remove shape/source/layer/scene-position
  count caps while retaining native validation.
- Coalesce Android clustering layout updates into one pending task per map;
  cancel queued work on pause/detach/disposal and refresh after resume. Marker
  counts and scene budgets are unchanged.
- Align the Android shader JNI library for 16 KB LOAD and RELRO pages with the
  pinned NDK 27 toolchain. Add a binary-level ELF verifier and record
  [16 KB emulator acceptance and dependency limits](docs/android-page-size.md).

- Add initial RN Maps Geojson, Heatmap, Overlay, WMSTile and LocalTile children,
  with bounded native preflight and a deterministic rendering verification scenario.
  Unsupported tile controls and broader asynchronous image recovery remain tracked.

### Added

- Repeatable component-cluster spatial/antimeridian acceptance with exact member
  audits, world-copy deduplication, group isolation and source/style/remount checks.

- `MapViewRef.reloadStyle()` retries the current style without remounting, with
  revision-scoped recoverable load errors and immediate pending-query invalidation.

- Marker accessibility hints, roles, state and custom actions with explicit
  grouping/opt-out for custom children. Selection-only markers now expose a single
  accessibility target. Nested-scroll and bottom-sheet gesture coordination are
  explicitly outside supported scope.

- React marker callouts with default text or interactive custom content, show/hide
  refs, map-local selection/press events, native attachment and lifecycle cleanup
  on iOS and Android. See [the contract](docs/marker-callouts.md).

- Native `UrlTile` imagery on iOS and Android with XYZ templates, tile size, source
  zoom bounds, opacity/visibility and shared shape/tile zIndex ordering. See
  [the contract](docs/url-tiles.md).

- Foreground native or app-owned user location, gesture-interruptible camera
  following, mounted-map PNG/JPEG snapshots and native draggable markers. See
  [contracts and limits](docs/location-snapshots-dragging.md); permission prompts
  remain application-owned and attached shader snapshots reject explicitly.

- RN Maps common API conventions: regions/controlled camera, native region-change
  callbacks, authoritative camera reads, partial updates, fit/bounds method aliases,
  nativeEvent presses, optional marker identifiers, image/default pins and
  centerOffset. Existing camera/fit helpers remain available. See
  [migration](docs/rn-maps-migration.md) for supported APIs and remaining differences.

- Package-owned MapLibre Native Fabric hosts for iOS and Android, React marker
  children, geographic shapes, camera/projection/fit helpers and capability reports.
- Opt-in `Marker.cluster` with default/custom React cluster components, lazy member
  metadata and expansion.
- `Marker.clusterGroup` isolates clustering by group on iOS and Android; custom
  cluster components receive the group name. A group implicitly enables clustering
  unless `cluster={false}` explicitly overrides it.
- Experimental `ShaderLayer` from `/shaders`, with WGSL, optional compute/storage,
  worklet scheduling and shared viewport output.

- Expo SDK 56 config plugin and reproducible packed core custom-build consumer.
  Debug/Release builds and simulator rendering/marker presses pass on both hosts.

### Fixed

- Guard native scene JSON nesting and lexical forms before platform parsing,
  preventing recursive-parser overflow while preserving accepted scenes and
  corrected-input recovery. Scene/dataset count and byte caps stay removed.

- Background snapshot cancellation invalidates generation ownership before native
  cleanup, preventing interrupted completions from publishing stale output.

- Fast Refresh effect replay now obtains a fresh native readiness report without
  replacing the map or resetting its camera. Queries, callouts and shader rendering
  recover; owned shader teardown can finish while readiness is being restored.

- Removed the arbitrary 10,000 clustered-marker cap across collection, native
  sources, visible layouts and membership queries. Existing scene byte/geometry
  budgets and query page sizes remain in force.

- Toggling marker clustering or replacing groups no longer renders an old native
  layout against new marker content while the React source revision catches up.

- Native scene graph and literal-style preflight rejects malformed layer updates
  before replacing working resources. Both hosts construct SDK source/layer
  objects before mutation; strict color/gradient checks prevent iOS newline-color
  coercion. Existing fitting and native feature hits survive rejected updates.

- Native GeoJSON preflight rejects malformed geometry and coerced numeric strings
  before replacing working scenes on either platform. Private generated-shape
  transport preserves dateline/world-copy geometry with separate bounded checks.
- Clustered markers preserve public Unicode, generated and `cluster:`-prefixed
  identifiers through private source compilation, native membership and layout.
  Private feature IDs follow the public 512-code-unit marker bound while source
  and layer names keep their separate SDK grammar.
- `fitElements` fits generated dateline circles, geodesic lines and polygons by
  normalizing accepted scene world copies before choosing the longitude arc.
  Explicit fit coordinates retain their geographic bounds.

- Android map rendering and marker frame work pause when detached or backgrounded;
  host resume cannot restart a detached or disposed map. Shared SDK file-source
  activation is retained across transient detaches and stopped on host pause or
  disposal.

- Camera fit requests reject sparse coordinate arrays before they serialize into
  invalid native point payloads.

- Shader reinitialization reuses a bundle rendering worker and exclusive idle GPU
  devices, avoiding repeated native-context allocation. Device error dispatchers
  release layer callbacks without retaining invalidated devices.
- Android shader repaint callbacks ignore disposed maps and stale style/layer
  ownership after remount or replacement.
- Internal GeoJSON validation rejects sparse coordinate axes and nested geometry
  arrays before they serialize into invalid native coordinates.

- Updateable geographic scalar/vector shader grids, validity masks, sampling helpers,
  fractional camera zoom and min/max zoom controls.
- Blue wind trails with live speed, trail length and density controls, stable
  local-coordinate motion and subpixel coverage.
- Viewport-only ShaderLayer output with a 50% resolution default, offscreen guard
  band, geographic projection helpers, and immediate native zoom-range hiding.

### Breaking changes

- Rename the package from `react-native-enhanced-maps` to
  `react-native-maplibre-maps`; update imports and Expo plugin configuration.

- Apple/Google provider experiments and TypeGPU raster/readback integration retired.
- Public `GeoJSONSource`, `Layer` and source-oriented cluster query APIs retired.
  Use geographic shape children for ordinary content; use `Marker.cluster` and
  `MapView.clusterComponent` for clustering. Sources/layers remain internal.
- Import shader support from `react-native-maplibre-maps/shaders` and install its
  optional WebGPU/Worklets peers. See [current package API](packages/maps/README.md)
  and [shader contract](docs/shader-layer.md).

### Known limits

Physical-device Release testing is deferred to the maintainer. Complete
compatibility/accessibility acceptance, optional GPU consumer integration and
release ownership/licensing remain open. Core bare and Expo consumer checks have
bounded build/simulator evidence; they do not establish hardware performance. See the
[checklist](FEATURE_CHECKLIST.md) for the complete current scope.
