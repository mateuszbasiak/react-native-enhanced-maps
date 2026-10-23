# Rendered feature press results

`GeoJSONSource.onPress(featureId)` retains its original callback. Add
`onFeaturePress(event)` to receive `sourceId`, `layerId`, `featureId`, `properties`,
`coordinate` and `position`. Either callback makes the source's layers interactive;
both may be supplied and each receives the same selected hit once.

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
malformed native events are discarded. Property payloads are bounded to 4 MiB
UTF-8 and nesting depth 16, matching the source scene limits.

This is a point query and returns one hit. Radius queries, overlap lists,
programmatic queries, cluster interactions and accessible feature navigation
remain separate checklist work. Callbacks do not establish release-performance
or complete cross-platform picking parity.
