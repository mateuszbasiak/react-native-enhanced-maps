# React Native Enhanced Maps

Private package-owned MapLibre Native integration. Not ready for production.
Exports `MapView`, `Marker`, `GeoJSONSource`, `Layer`, `Polyline`, `Polygon` and `Circle`.

```tsx
import { MapView, Marker } from 'react-native-enhanced-maps';

<MapView
  style={{ flex: 1 }}
  styleURL="https://demotiles.maplibre.org/style.json"
  initialCamera={{
    center: { latitude: 52.2, longitude: 21 },
    zoom: 12,
    heading: 0,
    pitch: 0,
  }}
>
  <Marker id="place" coordinate={{ latitude: 52.2, longitude: 21 }} zIndex={1}>
    <Pressable onPress={handlePress}>
      <Text>Place</Text>
    </Pressable>
  </Marker>
</MapView>;
```

Use ordinary React Native children and input handlers inside `Marker`. Higher
`zIndex` wins; equal values use marker creation order. Circle, line and fill layers
use GeoJSON sources and camelCase style properties. See the example for usage.

Android links MapLibre Native OpenGL 13.6.1 directly. iOS links MapLibre 6.31.0 via
Swift Package Manager alongside React Native Pods. In the consumer Podfile require
`react-native-enhanced-maps/maplibre-spm` (resolve the installed package path) and
call `EnhancedMaps.post_install(installer)` inside `post_install`, in addition to
`react_native_post_install`. The example Podfile shows the workspace equivalent.
Minimum iOS 16 and Android 24. Rebuild after native setup.

No Google/Apple map provider adapters, API keys, patched dependencies or React
Native MapLibre wrapper are used. A style URL and suitable tile hosting are required.
The optional TypeGPU companion is separate; live custom GPU layers remain future work.

Shape props and compatibility limits: [shape components](../../docs/shapes.md).

`GeoJSONSource` accepts optional producer revisions for stale-update rejection.
See [source revision semantics](../../docs/source-revisions.md) for replacement,
style reload and source-removal behavior.

Use `ref.getCapabilities()` or `onCapabilitiesChange` to read the current native
feature evidence states. See [capability reports](../../docs/capabilities.md).

Camera idle events expose [native movement provenance](../../docs/camera-origins.md).

Map refs provide asynchronous projection, visible bounds, `fitCoordinates` and
`fitElements`. See [map geometry and fitting](../../docs/map-geometry.md) for input
limits, padding, acceptance semantics and prototype constraints.

`GeoJSONSource.cluster` enables prototype native point clustering. Use
`Layer.clusterFilter="clusters"` or `"points"` for separate styles; structured
hits expose cluster IDs, point counts and opaque inspection handles. Map refs
provide bounded `getClusterChildren`, `getClusterLeaves` and
`getClusterExpansionZoom` queries. See [clustering](../../docs/clustering.md)
for revision rules, handle lifetime, reserved properties and prototype limits.
