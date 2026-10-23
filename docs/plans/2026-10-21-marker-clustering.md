# Marker clustering implementation plan

**Goal:** Expose only component-based map content, with opt-in Marker clustering and customizable cluster markers.

**Approved design:** Marker.cluster is a boolean defaulting to false. Marker.data is application-owned metadata. MapView.clusterComponent receives count, coordinate, lazy getMembers(), and expand(). A default count bubble expands on press. Remove public GeoJSONSource, Layer, their public types and source-oriented cluster methods. ShaderLayer remains reserved for the separate GPU implementation already underway.

**Architecture:** Compile participating direct/fragment Marker children into an internal MapLibre clustered source. Native rendered-feature queries publish visible cluster/point layouts after rendering; React mounts individual marker children or cluster marker children accordingly. Native index stamps and source revisions reject obsolete layouts/queries. Metadata stays in JavaScript and is resolved by ID only when requested. Existing sources/layers remain private rendering infrastructure.

**Tech stack:** React Native Fabric, TypeScript, MapLibre Native Kotlin/Objective-C++, Node contract tests.

1. Add failing marker-scene, layout validation, lazy membership and stale-generation tests; run them.
2. Implement marker collection/validation, private cluster source and native layout event on both platforms. Keep updates bounded and deduplicate layouts.
3. Add custom/default cluster rendering, lazy paged membership resolution, expansion and lifecycle invalidation. Preserve nonparticipating markers and existing shape presses.
4. Remove public source/layer exports and obsolete source-oriented query API; migrate examples, type tests, package checks and current documentation.
5. Run focused contracts, full package checks, bundles and available native builds; inspect changes and report any unverified runtime behavior.

Verification commands: npm run build; node --test tests/marker-clustering.test.mjs; npm run check; npm run example:bundle; npm run build:ios; npm run build:android -- -PreactNativeArchitectures=arm64-v8a.
