# RN Maps rendering components

The package exports initial implementations of `Geojson`, `Heatmap`, `Overlay`,
`WMSTile` and `LocalTile`, alongside [UrlTile](url-tiles.md). These use MapLibre
Native on both hosts; they do not expose style-spec source/layer components.
The [approved v1 contract](rendering-contract.md) is broader than this initial
support. Full RN Maps provider parity is not claimed.

## Geojson

```tsx
import { Geojson } from 'react-native-maplibre-maps';

<Geojson
  geojson={{
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: { name: 'Port' },
        geometry: { type: 'Point', coordinates: [18.66, 54.37] },
      },
    ],
  }}
  onPress={(overlay) => console.log(overlay.type, overlay.feature)}
/>;
```

FeatureCollection Point/MultiPoint, LineString/MultiLineString and
Polygon/MultiPolygon expand into existing markers/shapes. Coordinates use
GeoJSON longitude/latitude order. Polygon holes are retained. Null geometry and
GeometryCollection are rejected. Original features survive press callbacks;
`onPress` receives `{type, feature, coordinates, holes?}`, with coordinates
converted to LatLng objects. Shape presses require `tappable`; point presses use
Marker behavior. Custom point content uses `markerComponent`.

Common marker props include `color`, `image`, `title`, `anchor`, `centerOffset`
and `zIndex`. Shape props include stroke/fill colors, stroke width, cap/join,
miter limit and dash pattern. Feature `marker-color`, `stroke`, `fill` and
`stroke-width` override corresponding props. Stroke/fill opacity properties
multiply color alpha, including zero. React markers update directly;
`tracksViewChanges` is accepted as a no-op snapshot hint. Nonzero
`lineDashPhase` rejects explicitly, as do unsupported props.

Inputs are immutable. Limit: 10,000 features/positions/expanded outputs, 16
property nesting levels, 100,000 property values and 1 MiB property characters.
Geometry expansion also bounds aggregate array entries to 50,000 and rejects
undersized lines/rings before expanding subsequent geometry. Expanded shapes share batched native sources/layers and the
4 MiB UTF-8 scene budget. There is no additional shape/scene position-count or
source/layer-count cap. Feature reorder follows upstream's index-based
identity; stable React keys scope separate Geojson children.

## Heatmap

```tsx
<Heatmap
  points={[{ latitude: 54.37, longitude: 18.66, weight: 2 }]}
  radius={20}
  opacity={0.7}
  gradient={{
    colors: ['transparent', 'red'],
    startPoints: [0, 1],
    colorMapSize: 256,
  }}
/>
```

The native SDK draws weighted density with package-owned expressions. Radius is
10–50 screen units (default 20); opacity is 0–1 (default 0.7). Omitted weight is
one; zero contributes no density. Points are bounded to 50,000, latitude ±85,
longitude ±180 and weights 0–1,000,000. Aggregate scene limits still apply.

Gradients accept 1–256 React Native color strings and strictly increasing offsets
in [0,1]. `colorMapSize` is an integer from 2–1024 (default 256); the compiler
samples the gradient into a bounded native ramp. The package default is
transparent through green to red. MapLibre's kernel, density scale and color
interpolation can differ from Google Maps; these are not pixel-parity claims.
Heatmaps draw below shape/tile/overlay content and do not consume presses.

## Overlay

```tsx
<Overlay
  image={require('../assets/chart.png')}
  bounds={[
    [54.4, 18.8],
    [54.3, 18.5],
  ]}
  bearing={15}
  opacity={0.8}
  tappable
  onPress={({ nativeEvent }) => console.log(nativeEvent.coordinate)}
/>
```

Bounds are **[northeast, southwest]**, each `[latitude, longitude]`, matching
upstream Fabric normalization despite contradictory upstream prose. Positive
spans below 180 degrees and latitude ±85 are supported. Bearing normalizes
clockwise degrees; corners rotate in Mercator about the projected center. Native
image sources follow camera projection, heading and pitch.

Images accept required React Native assets or `{uri}` HTTP(S)/file sources.
Android drawable/asset resources are resolved natively. URI request headers,
methods/cache policies and data URIs reject explicitly. Up to eight images are
allowed; URI length is at most 4096 characters and existing 4 MiB scene limits
remain. There is not yet a package-enforced decoded-image byte/pixel budget.

Opacity defaults to one and tappable to false. Presses use a transparent native
polygon matching the image quad and report `nativeEvent.action: 'overlay-press'`,
coordinate and map-relative position. Alpha-zero pixels still belong to the
quad; opacity-zero overlays and nontappable overlays do not intercept map input.
The geographic footprint always participates in legacy `fitElements`, regardless
of press handlers or opacity; `fitToElements` remains marker-only.
At zIndex zero, declaration order determines placement with shapes/tiles;
markers remain their own ordering system. No new zIndex prop is added to Overlay.

Remote decoding/cancellation and old-image preservation after failed replacement
still require broader failure acceptance. Do not treat source-construction
preflight as proof of atomic asynchronous image replacement.

## WMSTile and LocalTile

```tsx
<WMSTile
  urlTemplate="https://example.com/wms?bbox={minX},{minY},{maxX},{maxY}&width={width}&height={height}&srs=EPSG:3857"
  tileSize={256}
/>;
<LocalTile
  pathTemplate="/absolute/app/path/tiles/{z}/{x}/{y}.png"
  tileSize={256}
/>;
```

WMSTile supports the standard contiguous `{minX},{minY},{maxX},{maxY}` bbox
sequence, translated to the SDK's EPSG:3857 token; width/height use tileSize.
Arbitrary separate/reordered bound placeholders are explicitly rejected. Common
props are `id`, `tileSize`, `minimumZ`, `maximumZ`, `opacity`, `visible`, `zIndex`,
with the same defaults/ranges and ordering as UrlTile. Applications supply the
service URL, projection/version parameters, credentials and attribution.

LocalTile supports `pathTemplate`, `tileSize`, `zIndex`, optional `id`, and Android
`useAssets`. Filesystem paths must be absolute (or file:/// URLs); spaces are
encoded. Asset paths are relative to Android assets and disallow parent traversal.
iOS rejects `useAssets` sources. The source has no HTTP URL and does not download
network tiles; the basemap can still fetch its own resources. Missing local tiles
are not a network fallback or an offline region downloader.

Neither tile component accepts unimplemented cache/offline controls,
`maximumNativeZ`, `doubleTileSize`, `shouldReplaceMapContent` or `flipY`.
These remain requirements under the full rendering contract; unsupported props
throw rather than silently pretending parity.

## Verification

Use the Debug example's **RN Maps rendering** scenario and
`node scripts/rendering-fixture.mjs` (port 8102) for deterministic WMS/image and
local tile fixtures. The scenario exposes `__enhancedMapsRendering` with
snapshot/configure, remount, style reload, projection and camera controls.
Automated coverage includes geometry expansion, original-feature callbacks,
malformed input, gradients, asset/bounds/rotation compilation and shared native
preflight for the new source/layer forms. Native build/runtime results are
recorded separately; unperformed checks are not passes. Physical-device checks
remain maintainer-owned follow-up.

### Bounded acceptance — 2026-10-28

The full repository check passed 336 tests, lint/format, public types, Codegen and
packed-consumer checks. Both production bundles also passed debug-global/secret
assertions. iOS arm64 Simulator and Android arm64 Debug builds passed.
Runtime used dedicated iPhone SE (2nd generation), iOS 26.1, and Pixel 9a/API 36
emulators, app ID `com.enhancedmapsexample.rendering`, Metro 8092 and fixture 8102.

Both hosts rendered Geojson points and polygon holes; point and polygon callbacks
retained the originating feature and hole taps fell through to the map. Weighted
Heatmap output rendered and disappeared after setting its weight to zero.
HTTP image overlays and required image assets rendered; an asymmetric four-color
image verified northeast/southwest bounds and clockwise 90-degree rotation.
Overlay presses routed correctly, while opacity zero allowed map presses.
Legacy `fitElements` produced equal zoom before/after disabling overlay opacity
(within 1e-5), proving its footprint does not depend on press registration.

WMS imagery rendered on both hosts. The fixture recorded 18 WMS requests with
four-value EPSG:3857 bounds and 256x256 dimensions. Local-file tiles rendered on
both hosts without adding any WMS requests. Android fixtures had to be copied into
app-private storage: externally pushed files were inaccessible under scoped
storage, and that initial blank-map attempt was not a rendering pass. Local tile
style reload, removal and restoration/remount completed without scene errors.
The bounded scenario collected six readiness events per host and the expected
point/polygon/map/overlay/map press sequence.

Review regressions cover file URL escaping, early geometry/property allocation
bounds and handler-independent overlay footprints. The actual rotated dateline
footprint also passes both native GeoJSON validators. Logs, runtime JSON and
screenshots are local ignored artifacts under `artifacts/rendering/`.

These checks do not establish arbitrary WMS token placement, Android asset-tile
rendering, full geographic/pitch/ordering matrices, decoded-image budgets,
atomic asynchronous image failure recovery, resource leak measurements or
Release acceptance for these new components. Physical-device checks remain
maintainer-owned follow-up.
