# Changelog

No public package release has been published. Entries below describe development
changes, not accepted production support or closed release gates.

## Unreleased

### Added

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
