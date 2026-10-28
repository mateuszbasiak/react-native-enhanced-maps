# V1 rendering contract

Approved scope: **2026-10-28**. This is the required public API direction, not an
implementation or parity claim. The initial implementations of `Heatmap`, `Overlay`, `Geojson`, `UrlTile`,
`WMSTile` and `LocalTile` are exported. See [current rendering support](rn-maps-rendering.md)
for implemented behavior and explicit compatibility gaps. Required v1 acceptance
and remaining props stay open in the [checklist](../FEATURE_CHECKLIST.md).

## Compatibility boundary

Use react-native-maps component names, prop shapes and observable behavior.
Applications should migrate these components by changing imports, subject to
explicitly documented differences. Use `Marker` for application icons and labels;
do not add `Symbol`, `Raster`, public source/layer descriptors or MapLibre style
expressions. Filtering ordinary component inputs remains application-owned.
Zoom limits belong to the upstream components that expose them, rather than a
new shared zoom-range API. Basemap styling remains `MapView.styleURL`.

The upstream references below were reviewed on 2026-10-28. They describe a moving
upstream branch, not a pinned, fully tested RN Maps compatibility baseline.
Implementation acceptance must record the exact upstream revision used for its
prop/default/event fixtures, including provider differences. Do not infer support
from a MapLibre SDK feature or add exports before their implementation exists.

## Required components

### Heatmap

Accept weighted geographic `points`, `radius`, `opacity` and `gradient`, with
upstream defaults (radius 20, opacity 0.7). Gradient configuration uses `colors`,
`startPoints` and `colorMapSize` (default 256). Preserve optional point weights.
Implement on both package hosts; upstream's Google-only availability does not
introduce provider selection here. Document density/kernel differences rather
than claiming identical provider pixels. No invented press/filter API is needed.
[Upstream Heatmap reference](https://github.com/react-native-maps/react-native-maps/blob/master/docs/heatmap.md).

### Overlay

Accept `image`, `bounds`, `bearing`, `opacity`, `tappable` and `onPress`. Images
use React Native required assets or URI sources. Bounds are two numeric
`[latitude, longitude]` tuples, not the package's `LatLng` objects. Follow the
upstream Fabric normalization: first northeast, then southwest. Upstream prose
uses conflicting corner descriptions; lock this interpretation with an asymmetric
image fixture and explicit migration examples. Bearing defaults to zero and
normalizes clockwise degrees; opacity defaults to one and tappable to false.

Provide the upstream-shaped native event with `action: 'overlay-press'`,
coordinate and map-relative position on both hosts. This deliberately unifies
provider-specific availability; it does not promise provider-specific action
strings. Bounds wrapping, rotation, camera alignment and image replacement need
acceptance fixtures, including antimeridian behavior, before completion.
[Upstream Overlay implementation](https://github.com/react-native-maps/react-native-maps/blob/v1.29.0/src/MapOverlay.tsx).

### Geojson

Accept a `geojson` FeatureCollection and render Point/MultiPoint,
LineString/MultiLineString and Polygon/MultiPolygon using the existing marker and
shape semantics, retaining polygon holes. This is a compatibility helper, not a
public MapLibre source. Preserve feature metadata and upstream styling precedence
for marker color, stroke, fill and stroke width. Carry the upstream marker and
shape customization props, including custom marker children, image, title,
anchor/offset, tracking, tappability and stroke options.

Its `onPress` receives the upstream overlay description (`type`, original
`feature`, converted `coordinates` and optional `holes`), rather than substituting
the ordinary shape nativeEvent callback. Multi-geometries retain their originating
feature. Apply existing input budgets to expanded output. Explicitly document
unsupported geometry kinds and inherited shape limitations, including dash phase,
instead of silently accepting them. A helper must not claim support for an
underlying prop the package still rejects.
[Upstream Geojson implementation](https://github.com/react-native-maps/react-native-maps/blob/master/src/Geojson.tsx).

### UrlTile and WMSTile

Use `UrlTile` (the upstream export spelling) and `WMSTile`, not a generic raster
component. Preserve `urlTemplate`, zoom limits (`minimumZ`, `maximumZ`,
`maximumNativeZ`), `tileSize`, `flipY`, `opacity`, `zIndex`, `doubleTileSize` and
`shouldReplaceMapContent`. URL tiles substitute x/y/z; WMS substitutes projected
bounds and image dimensions using upstream Web Mercator conventions. Distinguish
visibility limits from native tile resolution and overzoom.

Retain upstream cache controls (`tileCachePath`, `tileCacheMaxAge`, `offlineMode`):
cache layout, stale refresh and offline fallback require fixtures. Offline mode
must make no network requests. Application code owns cache eviction; a native
MapLibre cache is not automatically compatible. Record platform-specific
replacement/density behavior explicitly. Basemap replacement must compose
correctly when multiple tile children mount or unmount.
[Upstream tile reference](https://github.com/react-native-maps/react-native-maps/blob/master/docs/tiles.md).

### LocalTile

Accept `pathTemplate`, `tileSize`, `zIndex` and Android `useAssets`, matching
upstream file/asset addressing. Local tiles must work without a network fetch;
they do not imply a general offline basemap download API. Document asset support
as Android-specific and retain upstream defaults in compatibility fixtures.
[Upstream LocalTile implementation](https://github.com/react-native-maps/react-native-maps/blob/master/src/MapLocalTile.tsx).

## Shared behavior and acceptance

The private scene/compiler/native hosts own projection, resource identity and
cleanup. Components remain MapView children. Updates must preserve accepted
content when validation or replacement fails; stale asynchronous image/tile work
must not replace newer inputs or attach after unmount/style replacement. Invalid
inputs must fail explicitly through the documented validation/error path.
Network and decode failures must leave the map usable and permit corrected-input
recovery. Define numeric, image and request bounds before adding native transport.
Existing [scene budgets](scene-budgets.md) remain in force for existing transport;
new resource types need explicit limits, not exemptions.

Preserve existing shape zIndex/declaration and marker ordering rules. Specify and
verify ordering among new overlays, shapes and basemap labels before claiming
cross-component parity; there is no existing universal marker/style-layer zIndex.
Transparent or noninteractive output must preserve documented input fall-through.

Each component needs public declaration/import and packed-consumer checks,
validation/default/update contracts, and relevant native builds plus acceptance
on both simulators. Runtime fixtures must cover mount/update/remove, style reload,
ordering, geography and errors; add picking for interactive output, cache/offline
and cancellation checks for tiles, and alignment/image replacement for Overlay.
Record observed provider differences and performance/resource limits. Unavailable
checks are not passes. Physical-device validation remains maintainer-owned
follow-up under the repository's feature-completion policy.

## Checklist reconciliation

LAYER-03 maps to Marker icon/label behavior, not a Symbol API. LAYER-06–09 and
SRC-02 now track the RN Maps components above. Their old generic expression/filter
and zoom-range API requirements are superseded by component props and private
renderer implementation. This resolves public scope only: it does not close
implementation, ordering/picking, resource, compatibility or release gates.
Experimental `ShaderLayer` remains a separate package extension through `/shaders`.
