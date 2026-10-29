# Rendered feature press results

Public shapes expose `tappable` and `onPress`, receiving
`{nativeEvent:{identifier, coordinate, position}}`. Ordinary Marker children own
their React Native input handlers. Cluster children use the
[component clustering contract](clustering.md). Applications do not register
source-level `onFeaturePress` callbacks or query source handles.

Internally, native feature events include `sourceId`, `layerId`, `featureId`,
`properties`, `coordinate` and `position`. MapView validates those fields and
routes the selected hit to its owning component. The structured source callbacks
are private implementation details retained for native regressions.

`coordinate` is the geographic tap location, not the feature's geometry centroid.
`position` is relative to the map in logical points on both platforms. Properties
come from the SDK's actual rendered feature. They are not reconstructed from the
latest React props, which can differ after a native source-revision rejection.
SDKs represent absent/null GeoJSON properties as an empty object.

The native query visits interactive rendered layers from front to back and returns
the first hit. Noninteractive layers do not block interactive layers underneath.
Marker child touches retain their ownership and do not trigger the map picker.
Only a confirmed single tap selects a feature: double-tap zoom, continuous quick
zoom and long holds do not dispatch feature presses. iOS waits for the existing
SDK multi-tap/quick-zoom recognizers and a 500 ms long-hold exclusion; Android
uses its SDK's confirmed map click.
Queued events from an older style request are ignored. Identifiers, finite tap
geometry and JSON property objects are validated before either callback runs;
malformed native events are discarded. Property payloads retain a nesting depth limit of 16 and have no
serialized-byte cap.

This is a point query and returns one hit. Radius queries, overlap lists,
programmatic queries and accessible feature navigation
remain separate checklist work. Callbacks do not establish release-performance
or complete cross-platform picking parity.

Polygon fills are filtered against geographic hole geometry before selecting a
hit, preserving lower-layer/background fall-through; outlines remain independently
hittable. See [the native fix and bounded results](polygon-hole-picking.md).
