# Migrating from react-native-maps

Use the package's default MapView export and familiar named components. Supply a
MapLibre style URL; basemap services and credentials remain application-owned.

```tsx
import MapView, {
  Marker,
  Polyline,
  type Region,
} from 'react-native-maplibre-maps';
import { useRef } from 'react';

const initialRegion: Region = {
  latitude: 54.37,
  longitude: 18.66,
  latitudeDelta: 0.05,
  longitudeDelta: 0.08,
};

function ExploreMap() {
  const map = useRef<MapView>(null);
  return (
    <MapView
      ref={map}
      style={{ flex: 1 }}
      styleURL="https://tiles.openfreemap.org/styles/liberty"
      initialRegion={initialRegion}
      onPress={(event) => console.log(event.nativeEvent.coordinate)}
      onRegionChangeComplete={(region, { isGesture }) => {
        if (isGesture) console.log(region);
      }}
    >
      <Marker
        identifier="boat"
        coordinate={initialRegion}
        onPress={(event) => {
          console.log(event.nativeEvent.id);
          map.current?.animateCamera({ zoom: 14 }, { duration: 300 });
        }}
      />
    </MapView>
  );
}
```

## Supported common surface

MapView supports `initialRegion`, controlled `region` and `camera`,
`initialCamera`, `onRegionChange` and `onRegionChangeComplete`. Camera takes
precedence over region; initialCamera takes precedence over initialRegion.
Initial region fitting happens after native layout/readiness and before
`onMapReady`. Initial props are mount-only. Changed controlled values apply
without animation; value-equivalent rerenders and callback echoes do not refit.
A region describes a geographic envelope; aspect ratio, native zoom limits,
padding, heading and pitch can expand the visible envelope. Longitude spans are
explicit, including wide views and antimeridian crossing. Mercator polar limits
still apply. Region longitudeDelta must be greater than zero and less than 360;
exact full-world fitting is rejected because native world-edge projections can
collapse. Native callbacks may still report a full-world visible envelope.

Both region callbacks receive `(region, { isGesture })`; events carry native
viewport snapshots and style revisions. Intermediate fit calculations do not
produce public region events. There is no fixed event-rate promise.

Refs support `getCamera()`, `setCamera(partialCamera)`,
`animateCamera(partialCamera, { duration })`, `animateToRegion(region, duration)`,
`fitToCoordinates(coordinates, { edgePadding, animated })`,
`fitToElements({ edgePadding, animated })` (all markers, including clustered inputs), `getMapBoundaries()`,
`pointForCoordinate()` and `coordinateForPoint()`. `fitElements` also accepts RN
Maps options. Existing numeric camera durations, `fitCoordinates`,
`getVisibleBounds` and package-specific fit options remain supported.
Camera read/merge/dispatch and viewport reads are serialized so rapid partial
updates preserve earlier fields and following bounds/projection queries observe
the accepted commands. Native camera reads are authoritative. Legacy `fitElements`
includes shapes as well as markers; RN-style `fitToElements` fits markers only.
Camera fields are center, zoom, heading and pitch; zoom uses MapLibre units rather
than promising an identical cross-provider scale. Altitude-based cameras are not
supported. `setCamera` and fit methods return command-acceptance promises, not
animation-completion promises. `animateCamera` reports asynchronous failures via
`onError`; catch promises returned by the other methods. Commands require a ready
map; style replacement and disposal invalidate pending queries.

Map tap and long-press callbacks expose `nativeEvent.coordinate` and
`nativeEvent.position` in map-relative logical points. Existing top-level
coordinate/position/action fields remain available. Marker presses expose
`nativeEvent.action === 'marker-press'`, `nativeEvent.id` and
`nativeEvent.coordinate`. A marker press consumes the marker touch; interactive
children retain their own input behavior.

Markers accept `identifier`, optional package-specific `id`, `centerOffset`,
`anchor`, `image`, `pinColor`, `onPress`, `zIndex` and optional React children.
Children override image, which overrides the default colored pin. Local images
use React Native intrinsic asset dimensions. Omitted IDs are generated from
React key scopes; use stable keys or explicit identifiers for changing lists.
`id` wins over `identifier` for internal identity. `centerOffset` overrides
`offset`; without an explicit anchor it uses a centered anchor. Offsets are
logical points on both platforms. Component clustering remains opt-in through
`cluster` or `clusterGroup`.

Polyline, Polygon and Circle retain their existing coordinates, holes,
stroke/fill, geodesic, gradient and press contracts. Shared types include
`LatLng`, `Point`, `Region`, `EdgePadding`, `FitToOptions` and the `MapView` ref
type. MapMarker/MapPolyline/MapPolygon/MapCircle component and props aliases are
also exported.

`UrlTile` renders native HTTP(S) XYZ raster imagery with opacity, visibility,
source zoom bounds, tile size and zIndex. See [the exact tile contract](url-tiles.md);
local files, TMS, custom request headers and full provider parity are not implied.

## Remaining differences

`Geojson`, `Heatmap`, `Overlay`, `WMSTile` and `LocalTile` have initial
implementations alongside `UrlTile`. See [rendering support](rn-maps-rendering.md)
for supported props, tuple conventions and limitations. The
[approved v1 contract](rendering-contract.md) remains the compatibility target.

This is common API compatibility, not complete provider parity. Location, snapshots
and native marker dragging are covered by the [follow-up contract](location-snapshots-dragging.md).
[React callouts](marker-callouts.md) support title/description, custom content,
show/hide refs, selection/press events and attachment offsets. `MapCallout` is an
alias. Automatic camera panning and provider-specific bubble parity are outside
this contract. Animated marker coordinates,
AnimatedRegion, fitToSuppliedMarkers, map types, Google style arrays, provider
selection and altitude cameras remain unsupported. Keep application location
ownership and weather integration separate. Use MapLibre styles instead of
`provider`, `mapType`, `googleMapId` or `customMapStyle`.

The supported runtime remains Fabric on the pinned React Native baseline.
Switching imports does not establish support for an older RN/Expo runtime or
legacy architecture. See [compatibility](compatibility.md) and the
[API reference](../packages/maps/docs/api.md).

The reference contracts are the upstream [MapView API](https://github.com/react-native-maps/react-native-maps/blob/master/docs/mapview.md)
and [Marker API](https://github.com/react-native-maps/react-native-maps/blob/master/docs/marker.md).

## Repeatable runtime check

Run a Debug example against a dedicated Metro port, then run
`METRO_PORT=8090 npm run verify:rn-maps`. An optional logical debugger device ID
selects one target: `npm run verify:rn-maps -- <logicalDeviceId>`. Only attach the
verification examples to that Metro port: the check selects the runtime scenario,
remounts maps and changes camera state. It records bounded results under the
ignored `artifacts/rn-maps-parity/` directory and fails on assertion errors.

The example supports `RCT_METRO_PORT` in its iOS process environment. Android
Debug builds accept `-PverificationApplicationIdSuffix=.parity` for a separate
installation and `-PreactNativeDevServerPort=8090` for the test Metro port. The
normal example remains on 8088 by default.

The runtime assertions cover initial-region/onMapReady ordering, serial partial
updates, ordered camera and geometry reads, fit/bounds aliases, antimeridian
regions, single fit completion, controlled camera precedence, region updates,
callback echoes and marker-only fitting. Native touch/visual checks are recorded
separately in [verification](verification.md).
