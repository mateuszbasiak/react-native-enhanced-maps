# Compatibility

Current renderer: package-owned MapLibre Native on iOS and Android, with Fabric
components exported by `react-native-enhanced-maps`. Google Maps and Apple Maps
experiments have been removed; provider selection is not a public API.

Development baseline: React Native 0.85.3, React 19.2.3, iOS 16+, Android 24+,
MapLibre iOS 6.31.0, MapLibre Android OpenGL 13.6.1. This is a feasibility baseline,
not a broad compatibility guarantee. Native migration verification is ongoing.

The package does not claim react-native-maps drop-in compatibility. Circle, line
and fill sources/layers and custom React Native marker children are implemented.
Clustering, additional style types, live GPU layers, complete RNGH integration and
release-device performance benchmarks remain future work.
