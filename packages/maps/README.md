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
`Circle` compile to private MapLibre sources and layers. See the [public API reference](docs/api.md) for props, refs and event contracts.

Android links MapLibre Native OpenGL 13.6.1 directly. iOS links MapLibre 6.31.0 via
Swift Package Manager alongside React Native Pods. In the consumer Podfile require
`react-native-enhanced-maps/maplibre-spm` (resolve the installed package path) and
call `EnhancedMaps.post_install(installer)` inside `post_install`, in addition to
`react_native_post_install`. The example Podfile shows the workspace equivalent.
Minimum iOS 16 and Android 24. Rebuild after native setup.

No Google/Apple map provider adapters, API keys, patched dependencies or React
Native MapLibre wrapper are used. A style URL and suitable tile hosting are required.
Experimental `ShaderLayer` accepts WGSL programs, optional layer-wide compute state and uniforms. World-anchored viewport output is submitted on a dedicated worklet runtime. See [contract and limits](https://github.com/mateuszbasiak/react-native-maplibre-maps/blob/main/docs/shader-layer.md). TypeGPU may later be an optional typed authoring tool.

Shape props and compatibility limits: [shape components](https://github.com/mateuszbasiak/react-native-maplibre-maps/blob/main/docs/shapes.md).

Use `ref.getCapabilities()` or `onCapabilitiesChange` to read the current native
feature evidence states. See [capability reports](https://github.com/mateuszbasiak/react-native-maplibre-maps/blob/main/docs/capabilities.md).

Camera idle events expose [native movement provenance](https://github.com/mateuszbasiak/react-native-maplibre-maps/blob/main/docs/camera-origins.md).

Map refs provide asynchronous projection, visible bounds, `fitCoordinates` and
`fitElements`. See [map geometry and fitting](https://github.com/mateuszbasiak/react-native-maplibre-maps/blob/main/docs/map-geometry.md) for input
limits, padding, acceptance semantics and prototype constraints.

Set `cluster` or `clusterGroup` on participating `Marker` children. Nonparticipating markers remain
independent. `MapView.clusterComponent` optionally supplies custom React cluster
contents; the default count bubble expands on press. Custom components receive
`count`, `coordinate`, `clusterGroup`, lazy `getMembers()` and `expand()`. Membership includes
marker IDs, coordinates and application-owned `Marker.data`; metadata stays in JS.
Obsolete cluster operations reject after index, style or map replacement.

Use `clusterGroup="boats"` to restrict clustering to opted-in markers with exactly
that group name. Different groups never merge, even at identical coordinates;
proximity and zoom still determine clusters within a group. Omission uses the
shared default group when `cluster={true}`. A group enables clustering by default;
explicit `cluster={false}` overrides it. Omitting both props keeps a marker
independent. Group names must be nonblank strings of at
most 512 characters. Custom cluster components receive the group's name, or
undefined for the default group. Each group consumes one source and one layer
within the map's shared 64-source/128-layer scene limits. The total clustered
marker limit remains 10000. Different groups may overlap visually. Changing a
group invalidates existing cluster operations.

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

The current input limit is 10,000 clustered markers. Component acceptance covers 1k/10k membership and updates on both simulators.
Broader spatial parity remains open; physical-device performance checks are
maintainer-owned deferred follow-up. Source-oriented query
APIs in older documents describe internal or historical infrastructure.

Import experimental `ShaderLayer` separately from
`react-native-enhanced-maps/shaders`. Its optional peers are
`react-native-webgpu@0.17.x` and `react-native-worklets@0.12.2`; configure the
Worklets Babel plugin as in the example and rebuild native projects. Core-only
consumers do not need these peers. See [ShaderLayer](https://github.com/mateuszbasiak/react-native-maplibre-maps/blob/main/docs/shader-layer.md).

## Installation status

This package remains private and UNLICENSED. Use a locally packed tarball for the
supported baseline: React Native 0.85.3 / React 19.2.3, New Architecture only.
Do not treat the package name as a published npm release. Start with the
[packed-consumer instructions](https://github.com/mateuszbasiak/react-native-maplibre-maps/blob/main/docs/native-consumers.md),
including the documented npm optional-peer resolver override. Those instructions
record actual core-only Debug/Release builds and Release simulator startup.

Android uses ordinary React Native autolinking; minimum API 24. For iOS, add the
installed package's SPM hook to the existing Podfile and preserve the ordinary
React Native setup. Resolve the package entry and then its adjacent hook:

```ruby
maps_entry = Pod::Executable.execute_command('node', ['-p',
  'require.resolve("react-native-enhanced-maps", {paths: [process.argv[1]]})',
  __dir__]).strip
require File.expand_path('../maplibre-spm', File.dirname(maps_entry))

# Inside the existing target's post_install block:
# EnhancedMaps.post_install(installer)
# react_native_post_install(installer, config[:reactNativePath], ...)
```

The published entry path is `lib/index.js`, so the hook resolves at the package
root. Call `EnhancedMaps.post_install(installer)` before the existing
`react_native_post_install`, run `pod install`, and rebuild. Minimum iOS is 16.
The integration pins the MapLibre SPM binary; do not add another wrapper's Pods or
SPM hook. For generated Expo projects use the config plugin below instead of
adding this manual hook. Expo Go cannot load this custom native package.

The README and [API reference](docs/api.md) are included in the tarball. Detailed
repository documentation uses absolute links so it remains reachable from an
installed package. Physical-device checks do not block feature completion, but
unmeasured devices and broader compatibility are not claimed as passing.

## Expo custom builds

For Expo SDK 56 / RN 0.85.3, install the packed package and add
`"react-native-enhanced-maps"` to `expo.plugins`. The config plugin adds the iOS
MapLibre SPM hook; Android uses autolinking. Use a custom native build, not Expo Go.
See [Expo setup and validation](https://github.com/mateuszbasiak/react-native-maplibre-maps/blob/main/docs/expo.md)
for the pinned template, optional-peer resolver requirement and reproducible
consumer command. Do not combine a manual iOS hook with plugin management.
