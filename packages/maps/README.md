# React Native Enhanced Maps

Private package-owned MapLibre Native integration. Not ready for production.
Exports `MapView`, `Marker`, `Polyline`, `Polygon` and `Circle`.

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
`zIndex` wins; equal values use marker creation order. `Polyline`, `Polygon` and
`Circle` compile to private MapLibre sources and layers. See the example for usage.

Android links MapLibre Native OpenGL 13.6.1 directly. iOS links MapLibre 6.31.0 via
Swift Package Manager alongside React Native Pods. In the consumer Podfile require
`react-native-enhanced-maps/maplibre-spm` (resolve the installed package path) and
call `EnhancedMaps.post_install(installer)` inside `post_install`, in addition to
`react_native_post_install`. The example Podfile shows the workspace equivalent.
Minimum iOS 16 and Android 24. Rebuild after native setup.

No Google/Apple map provider adapters, API keys, patched dependencies or React
Native MapLibre wrapper are used. A style URL and suitable tile hosting are required.
Experimental `ShaderLayer` accepts WGSL programs, optional layer-wide compute state and uniforms. World-anchored tile output is submitted on a dedicated worklet runtime. See [contract and limits](../../docs/shader-layer.md). TypeGPU may later be an optional typed authoring tool.

Shape props and compatibility limits: [shape components](../../docs/shapes.md).

Use `ref.getCapabilities()` or `onCapabilitiesChange` to read the current native
feature evidence states. See [capability reports](../../docs/capabilities.md).

Camera idle events expose [native movement provenance](../../docs/camera-origins.md).

Map refs provide asynchronous projection, visible bounds, `fitCoordinates` and
`fitElements`. See [map geometry and fitting](../../docs/map-geometry.md) for input
limits, padding, acceptance semantics and prototype constraints.

Set `cluster` on participating `Marker` children. Nonparticipating markers remain
independent. `MapView.clusterComponent` optionally supplies custom React cluster
contents; the default count bubble expands on press. Custom components receive
`count`, `coordinate`, lazy `getMembers()` and `expand()`. Membership includes
marker IDs, coordinates and application-owned `Marker.data`; metadata stays in JS.
Obsolete cluster operations reject after index, style or map replacement.

```tsx
<Marker
  id="place"
  coordinate={{ latitude: 52.2, longitude: 21 }}
  cluster
  data={{ title: 'Place' }}
>
  <Text>Place</Text>
</Marker>
```

The current input limit is 10,000 clustered markers. End-to-end component acceptance,
spatial parity and physical-device performance remain open. Source-oriented query
APIs in older documents describe internal or historical infrastructure.

Import experimental `ShaderLayer` separately from
`react-native-enhanced-maps/shaders`. Its optional peers are
`react-native-webgpu@0.17.x` and `react-native-worklets@0.12.2`; configure the
Worklets Babel plugin as in the example and rebuild native projects. Core-only
consumers do not need these peers. See [ShaderLayer](../../docs/shader-layer.md).
