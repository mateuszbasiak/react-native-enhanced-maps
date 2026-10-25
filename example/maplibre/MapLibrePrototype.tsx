import ExampleControls from '../ExampleControls';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, {
  Marker,
  Circle,
  Polygon,
  Polyline,
} from 'react-native-enhanced-maps';
import type {
  Coordinate,
  MapPoint,
  MapViewRef,
  ShapePressEvent,
} from 'react-native-enhanced-maps';
import { createFleet, route } from './fixtures';
const geodesicRoute = [
  { latitude: 55, longitude: -60 },
  { latitude: 55, longitude: 60 },
];
const geodesicArea = [...geodesicRoute, { latitude: 15, longitude: 0 }];
const geodesicHoles = [
  [
    { latitude: 40, longitude: -10 },
    { latitude: 40, longitude: 10 },
    { latitude: 50, longitude: 0 },
  ],
];
const harborCamera = {
  center: { latitude: 54.37, longitude: 18.66 },
  zoom: 12,
  heading: 0,
  pitch: 0,
};
const geodesicCamera = {
  center: { latitude: 50, longitude: 0 },
  zoom: 0.4,
  heading: 0,
  pitch: 0,
};
type DebugGlobal = typeof globalThis & {
  __enhancedMapsShapes?: {
    snapshot(): {
      ready: boolean;
      selection: string;
      geodesicDemo: boolean;
      pressCount: number;
      lastPress: ShapePressEvent['nativeEvent'] | null;
    };
    point(coordinate: Coordinate): Promise<MapPoint>;
    coordinate(point: MapPoint): Promise<Coordinate>;
  };
};
export default function MapDemo() {
  const [count, setCount] = useState(1000),
    [visible, setVisible] = useState(true),
    [ready, setReady] = useState(false),
    [selection, setSelection] = useState(''),
    [generation, setGeneration] = useState(0),
    [geodesicDemo, setGeodesicDemo] = useState(false);
  const camera = useRef<MapViewRef>(null),
    step = useRef(0),
    presses = useRef<{
      count: number;
      last: ShapePressEvent['nativeEvent'] | null;
    }>({ count: 0, last: null });
  const selectShape = (event: ShapePressEvent) => {
    presses.current = {
      count: presses.current.count + 1,
      last: event.nativeEvent,
    };
    setSelection(event.nativeEvent.identifier);
  };
  const data = useMemo(() => createFleet(count), [count]);
  useEffect(() => {
    if (!__DEV__) return;
    const target = globalThis as DebugGlobal;
    const api = {
      snapshot: () => ({
        ready,
        selection,
        geodesicDemo,
        pressCount: presses.current.count,
        lastPress: presses.current.last,
      }),
      point: async (coordinate: Coordinate) => {
        if (!camera.current || !ready) throw new Error('Map is not ready');
        return camera.current.pointForCoordinate(coordinate);
      },
      coordinate: async (point: MapPoint) => {
        if (!camera.current || !ready) throw new Error('Map is not ready');
        return camera.current.coordinateForPoint(point);
      },
    };
    target.__enhancedMapsShapes = api;
    return () => {
      if (target.__enhancedMapsShapes === api)
        delete target.__enhancedMapsShapes;
    };
  }, [ready, selection, geodesicDemo]);
  return (
    <View style={{ flex: 1 }}>
      <Text style={{ padding: 8 }}>
        Package-owned MapLibre · {ready ? 'Ready' : 'Loading'} · {count} points
        · selected {selection || 'none'}
      </Text>
      <ExampleControls>
        <View style={styles.row}>
          {[100, 1000, 10000].map((n) => (
            <Button key={n} title={`${n} points`} onPress={() => setCount(n)} />
          ))}
          <Button
            title={visible ? 'Hide points' : 'Show points'}
            onPress={() => setVisible((v) => !v)}
          />
          <Button
            title="Camera path"
            disabled={!ready || geodesicDemo}
            onPress={() =>
              camera.current?.animateCamera(
                {
                  center: { latitude: 54.37, longitude: 18.66 },
                  zoom: 13,
                  heading: (++step.current % 4) * 70,
                  pitch: 45,
                },
                2000,
              )
            }
          />
          <Button
            title={geodesicDemo ? 'Harbor shapes' : 'Geodesic shapes'}
            disabled={!ready}
            onPress={() => {
              setSelection('');
              setGeodesicDemo(!geodesicDemo);
              camera.current?.animateCamera(
                geodesicDemo ? harborCamera : geodesicCamera,
                0,
              );
            }}
          />
          <Button
            title="Remount"
            onPress={() => {
              setReady(false);
              setGeneration((v) => v + 1);
            }}
          />
        </View>
      </ExampleControls>
      <MapView
        key={generation}
        ref={camera}
        style={{ flex: 1 }}
        styleURL="https://tiles.openfreemap.org/styles/liberty"
        initialCamera={geodesicDemo ? geodesicCamera : harborCamera}
        onMapReady={() => setReady(true)}
        onError={(e) => setSelection(e.code)}
      >
        <Polyline
          id="route"
          coordinates={route.geometry.coordinates.map(
            ([longitude, latitude]) => ({ latitude, longitude }),
          )}
          strokeColor="rgb(239, 66, 116)"
          strokeWidth={12}
          opacity={0.85}
        />
        {visible &&
          !geodesicDemo &&
          data.features.map((feature) => {
            const [longitude, latitude] =
              feature.geometry.type === 'Point'
                ? feature.geometry.coordinates
                : [0, 0];
            return (
              <Marker
                key={feature.id}
                id={feature.id}
                coordinate={{ latitude, longitude }}
                cluster
                data={feature.properties}
                anchor={{ x: 0.5, y: 0.5 }}
              >
                <Pressable
                  accessibilityLabel={`Select ${feature.id}`}
                  onPress={() => setSelection(feature.id)}
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 5,
                    backgroundColor: '#145e99',
                  }}
                />
              </Marker>
            );
          })}
        <Circle
          id="harbor-circle"
          center={{ latitude: 54.37, longitude: 18.66 }}
          radius={450}
          fillColor="rgba(22, 160, 133, 0.25)"
          strokeColor="teal"
          strokeWidth={3}
          lineDashPattern={[9, 6]}
          tappable
          onPress={selectShape}
        />
        <Polygon
          id="harbor-area"
          coordinates={[
            { latitude: 54.38, longitude: 18.64 },
            { latitude: 54.385, longitude: 18.66 },
            { latitude: 54.38, longitude: 18.68 },
          ]}
          fillColor="#e67e2240"
          strokeColor="#e67e22"
          tappable
          onPress={selectShape}
        />
        <Polyline
          id="harbor-path"
          coordinates={[
            { latitude: 54.36, longitude: 18.64 },
            { latitude: 54.365, longitude: 18.66 },
            { latitude: 54.36, longitude: 18.68 },
          ]}
          strokeColor="#8e44ad"
          strokeWidth={5}
          lineCap="square"
          lineJoin="bevel"
          lineDashPattern={[12, 6]}
          tappable
          onPress={selectShape}
        />
        {geodesicDemo && (
          <>
            <Polygon
              id="geodesic-area"
              coordinates={geodesicArea}
              holes={geodesicHoles}
              geodesic
              fillColor="#16a08530"
              strokeColor="#16a085"
              strokeWidth={2}
              tappable
              onPress={selectShape}
            />
            <Polyline
              id="straight-reference"
              coordinates={geodesicRoute}
              strokeColor="#145e99"
              strokeWidth={3}
              lineDashPattern={[8, 4]}
            />
            <Polyline
              id="geodesic-route"
              coordinates={geodesicRoute}
              geodesic
              strokeColor="#ef4274"
              strokeWidth={6}
              tappable
              onPress={selectShape}
            />
          </>
        )}
      </MapView>
      <Text style={{ padding: 8 }}>
        MapLibre Native owns basemap and layer projection. This example imports
        only the core package.{' '}
        {geodesicDemo
          ? 'Pink follows the shortest great-circle arc; dashed blue joins the same endpoints in the map projection. Green is a geodesic polygon with a hole.'
          : 'Public demo tiles require internet.'}
      </Text>
    </View>
  );
}
const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap' },
});
