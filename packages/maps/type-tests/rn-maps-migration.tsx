// Compiler-checked migration examples linked from docs/compatibility.md.
// No native components are mounted by this fixture.
import { useRef } from 'react';
import { Pressable, Text } from 'react-native';
import MapView, { Marker, Polyline, Polygon, Circle } from '../src/index.js';
import type {
  Camera,
  MapViewProps,
  MapViewRef,
  MarkerProps,
} from '../src/index.js';

const center = { latitude: 54.37, longitude: 18.66 };
const camera: Camera = { center, zoom: 12, heading: 0, pitch: 0 };
const route = [center, { latitude: 54.38, longitude: 18.68 }];
const ring = [...route, { latitude: 54.36, longitude: 18.68 }];

export function MigratedMap() {
  const map = useRef<MapViewRef>(null);
  return (
    <MapView
      ref={map}
      style={{ flex: 1 }}
      styleURL="https://example.com/style.json"
      initialCamera={camera}
      mapPadding={{ top: 20, right: 20, bottom: 40, left: 20 }}
      onMapReady={() => map.current?.animateCamera(camera, 300)}
      onPress={({ coordinate, position }) => {
        console.log(coordinate.latitude, position.x);
      }}
      onCameraIdle={({ camera: next, origin }) => {
        console.log(next.zoom, origin);
      }}
    >
      <Marker id="harbour" coordinate={center} anchor={{ x: 0.5, y: 1 }}>
        <Pressable
          accessibilityLabel="Harbour"
          onPress={() => console.log('harbour')}
        >
          <Text>Harbour</Text>
        </Pressable>
      </Marker>
      <Polyline
        id="route"
        coordinates={route}
        strokeColors={['red', 'blue']}
        strokeWidth={3}
        geodesic
        tappable
        onPress={({ nativeEvent }) => console.log(nativeEvent.identifier)}
      />
      <Polygon coordinates={ring} holes={[]} fillColor="#0088ff40" />
      <Circle center={center} radius={450} strokeColor="blue" />
    </MapView>
  );
}

// Invoke after readiness. These promises acknowledge commands, not animation end.
export async function fitRoute(map: MapViewRef) {
  await map.fitCoordinates(route, { padding: 24, durationMs: 300 });
  await map.fitElements({ padding: 24, durationMs: 0 });
  const point = await map.pointForCoordinate(center);
  const coordinate = await map.coordinateForPoint(point);
  const bounds = await map.getVisibleBounds();
  return { coordinate, bounds };
}

// Guard the documented unsupported boundary against accidental parity claims.
const unsupportedMap: MapViewProps = {
  styleURL: 'https://example.com/style.json',
  // @ts-expect-error controlled region is not supported
  region: { ...center, latitudeDelta: 1, longitudeDelta: 1 },
};
const unsupportedMarker: MarkerProps = {
  id: 'pin',
  coordinate: center,
  children: null,
  // @ts-expect-error dragging is not a marker API
  draggable: true,
};
void unsupportedMap;
void unsupportedMarker;
declare const map: MapViewRef;
// @ts-expect-error camera updates require a complete Camera
map.animateCamera({ zoom: 8 });
// @ts-expect-error duration is a number, not RN Maps options
map.animateCamera(camera, { duration: 300 });
// @ts-expect-error renamed fit method
map.fitToCoordinates(route);
// @ts-expect-error snapshots are not implemented
map.takeSnapshot({});
// @ts-expect-error no camera getter is exported
map.getCamera();
const press: NonNullable<MapViewProps['onPress']> = (event) => {
  // @ts-expect-error direct map payload has no nativeEvent wrapper
  console.log(event.nativeEvent.coordinate);
};
void press;
// @ts-expect-error markers require stable id and explicit children
<Marker coordinate={center} />;
// @ts-expect-error dash phase is not implemented
<Polyline coordinates={route} lineDashPhase={2} />;
