> Historical source/layer prototype, superseded by [standalone native components](native-components.md). These source/layer components are no longer public exports.

# Sources and layers

The initial API separates immutable geographic data from its rendering. A source
has a stable map-scoped ID and a revision. Multiple layers reference that source,
with their own stable IDs, styles and visibility. SDK adapters own projection;
there is no screen-space canvas or camera-frame transport to JavaScript.

```tsx
import MapView, {
  GeoJSONSource,
  LineLayer,
  FillLayer,
} from 'react-native-enhanced-maps';
import type { GeoJSONData } from 'react-native-enhanced-maps';

// Keep this immutable reference stable until the dataset changes.
const data: GeoJSONData = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      id: 'route',
      properties: { name: 'Route' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [21, 52],
          [21.01, 52.01],
        ],
      },
    },
  ],
};

<MapView>
  <GeoJSONSource id="routes" revision={1} data={data}>
    <LineLayer id="outline" style={{ lineColor: '#123456', lineWidth: 8 }} />
    <LineLayer id="route" style={{ lineColor: '#0088ff', lineWidth: 4 }} />
  </GeoJSONSource>
</MapView>;
```

LineLayer supports `lineColor`, `lineWidth` and `lineOpacity`; FillLayer supports
`fillColor` and `fillOpacity`. Colors are #RRGGBB or #RRGGBBAA. Opacity is 0–1;
line widths are 0–256 React Native layout points. Zero width hides the stroke.
Defaults: #0088ff, opacity 1, line width 2. `visible={false}` hides a layer while
retaining its resource identity. Removing the element removes its native objects.

Layers nested directly in a source infer its ID. Standalone layers use
`source="routes"`; declaration before the source is allowed. Fragments, arrays
and conditional children are supported. Arbitrary React wrapper components and
native View children inside MapView are explicitly rejected in this first API.
The declarative elements are consumed by MapView, not mounted as native views.

GeoJSONData accepts a FeatureCollection of Point, MultiPoint, LineString,
MultiLineString, Polygon or MultiPolygon geometries. Positions are exactly two
finite numbers in [longitude, latitude] order. Features require unique string IDs
and JSON object/null properties. Polygon rings must be closed, with at least four
positions; the first ring is exterior and subsequent rings are holes. Line layers
render line geometries and polygon boundaries; fill layers render polygons.
Point geometries remain data and are ignored by these two layer kinds.

Data must be immutable. Increase `revision` on replacement; changing a data
reference at the same revision or decreasing its revision throws. Style changes
reuse the source serialization and native geometry. Native adapters independently
reject stale replacements. Removing and re-adding a source starts a new lifetime;
remounting a map starts a new scene. Source removal must also remove its layers,
otherwise graph validation rejects the missing dependency.

Limits: 64 sources, 64 layers, 10000 features/source, 50000 total source positions,
100000 conservative rendered positions, 65536 property nodes/source, property
nesting 16, and a combined 4 MiB serialized source payload measured in UTF-16 code
units. Inputs are validated before native mutation; native scene errors are
recoverable `layer-scene` errors. Parsing and SDK mutations currently run on the
native UI thread: large-data performance and background indexing remain work.

Layers render in declaration order within the package's native shape-overlay
group. No cross-provider insertion relative to basemap labels, marker annotations,
3D buildings or GPU content is promised. MapKit uses overlays above roads; Google
uses shape z-indices. MapKit groups a layer into MKMultiPolyline/MKMultiPolygon;
Google retains polylines/polygons individually. Antimeridian, poles and
self-intersecting geometry need separate provider fixtures; validation of numeric
coordinates does not establish identical rendering at those geographic edges.

This is the first layer implementation, not full Mapbox style-spec compatibility.
Filters, expressions, zoom ranges, picking, feature patches, clustering,
symbol/circle/raster/heatmap layers and GPU extensions remain future slices.
Wind should eventually be a velocity-field source plus a particle layer under
this same ownership model; no wind renderer is currently exported.
