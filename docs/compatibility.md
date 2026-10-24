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
snapshots and Expo integration are not implemented. Public source/layer components
and their old cluster-query APIs were retired. Symbol/icon, raster/tile, heatmap
and expression/filter requirements still need reconciliation with the component
API. Complete RNGH/input, accessibility, lifecycle and spatial-parity matrices
remain checklist work.

Older prototype and source/layer documents are historical/internal descriptions,
not alternate public API specifications. Exact RN Maps parity fixtures and a
pinned comparison baseline remain open under COMPAT-01–02/05–06/08–09.
