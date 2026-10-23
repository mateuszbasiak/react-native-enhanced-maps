> Historical prototype record. Apple/Google experiments were removed in the package-owned MapLibre migration. See the root README and package source for the current API; earlier verification does not verify the migrated native implementation.

# SDK-native map components

`Polyline` and `Polygon` are standalone MapView children with `id`, `zIndex`,
`visible` and `opacity`. MapView consumes their descriptors; provider SDK shapes
own projection and drawing. There is no shared custom drawing surface or native
animation loop. The source/layer transport is an internal implementation detail.

```tsx
<MapView initialCamera={camera}>
  <Polygon
    id="area"
    coordinates={boundary}
    holes={holes}
    fillColor="#0088ff40"
    strokeColor="#123456"
    zIndex={0}
  />
  <Polyline
    id="route"
    coordinates={route}
    strokeColor="#0088ff"
    strokeWidth={4}
    zIndex={10}
  />
</MapView>
```

Coordinates are latitude/longitude objects. Polygon rings may be open and close
automatically; holes use arrays of rings. Colors accept #RRGGBB or #RRGGBBAA.
Stroke width is in React Native layout points, 0–256. Common defaults: visible true,
opacity 1, zIndex 0, strokeColor #0088ff, strokeWidth 2. Polygon fill defaults to
#0088ff40. IDs require 1–128 letters, digits, _, ., : or -. Data arrays are immutable;
replace references when geometry changes. Style changes reuse native source data.
Removing a component removes its owned shapes. Map remount starts a new lifetime.
Fragments, arrays and conditional direct children work; arbitrary wrapper
components and native View children are unsupported in this first version.

Higher zIndex requests drawing later. Ties retain declaration order. Google uses
SDK shape z-indices; Apple uses ordered overlays above roads. Provider groups,
markers, labels, buildings and the experimental raster have separate ordering
rules: no strict universal zIndex guarantee is made. A polygon's fill and outline
are adjacent SDK overlays in this initial adapter. Revisit cross-kind ordering
only when product requirements justify the extra renderer complexity.

At most 64 components and 10000 total positions including closed rings and holes.
Coordinates are finite, latitude within ±85°, longitude within ±180°. zIndex is
finite within ±1e6; opacity 0–1. Native adapters validate transport independently.
Antimeridian, poles, self-intersections, detailed gestures and shape press events
need separate implementation/fixtures. This is not full react-native-maps parity.

Heatmap and ParticleLayer are planned; neither is currently exported. Their native
provider implementations and portability need separate evaluation. The shared
CPU renderer experiment was dropped, and its performance results are historical.
