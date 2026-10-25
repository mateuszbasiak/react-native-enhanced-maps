# Changelog

No public package release has been published. Entries below describe development
changes, not accepted production support or closed release gates.

## Unreleased

### Added

- Package-owned MapLibre Native Fabric hosts for iOS and Android, React marker
  children, geographic shapes, camera/projection/fit helpers and capability reports.
- Opt-in `Marker.cluster` with default/custom React cluster components, lazy member
  metadata and expansion.
- `Marker.clusterGroup` isolates clustering by group on iOS and Android; custom
  cluster components receive the group name. A group implicitly enables clustering
  unless `cluster={false}` explicitly overrides it.
- Experimental `ShaderLayer` from `/shaders`, with WGSL, optional compute/storage,
  worklet scheduling and bounded shared world-tile output.

- Expo SDK 56 config plugin and reproducible packed core custom-build consumer.
  Debug/Release builds and simulator rendering/marker presses pass on both hosts.

### Fixed

- Camera fit requests reject sparse coordinate arrays before they serialize into
  invalid native point payloads.

- Shader reinitialization reuses a bundle rendering worker and exclusive idle GPU
  devices, avoiding repeated native-context allocation. Device error dispatchers
  release layer callbacks without retaining invalidated devices.
- Android shader repaint callbacks ignore disposed maps and stale style/layer
  ownership after remount or replacement.
- Internal GeoJSON validation rejects sparse coordinate axes and nested geometry
  arrays before they serialize into invalid native coordinates.

### Breaking changes

- Apple/Google provider experiments and TypeGPU raster/readback integration retired.
- Public `GeoJSONSource`, `Layer` and source-oriented cluster query APIs retired.
  Use geographic shape children for ordinary content; use `Marker.cluster` and
  `MapView.clusterComponent` for clustering. Sources/layers remain internal.
- Import shader support from `react-native-enhanced-maps/shaders` and install its
  optional WebGPU/Worklets peers. See [current package API](packages/maps/README.md)
  and [shader contract](docs/shader-layer.md).

### Known limits

Physical-device Release testing is deferred to the maintainer. Complete
compatibility/accessibility acceptance, optional GPU consumer integration and
release ownership/licensing remain open. Core bare and Expo consumer checks have
bounded build/simulator evidence; they do not establish hardware performance. See the
[checklist](FEATURE_CHECKLIST.md) for the complete current scope.
