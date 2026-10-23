import React, { useMemo, useRef, useState } from 'react';
import { Button, StyleSheet, Text, View } from 'react-native';
import MapView, {
  GeoJSONSource,
  Layer,
  Circle,
  Polygon,
  Polyline,
} from 'react-native-enhanced-maps';
import type { MapViewRef } from 'react-native-enhanced-maps';
import { createFleet, route } from './fixtures';
export default function MapDemo() {
  const [count, setCount] = useState(1000),
    [visible, setVisible] = useState(true),
    [ready, setReady] = useState(false),
    [selection, setSelection] = useState(''),
    [generation, setGeneration] = useState(0);
  const [below, setBelow] = useState(true);
  const camera = useRef<MapViewRef>(null),
    step = useRef(0);
  const data = useMemo(() => createFleet(count), [count]);
  return (
    <View style={{ flex: 1 }}>
      <Text style={{ padding: 8 }}>
        Package-owned MapLibre · {ready ? 'Ready' : 'Loading'} · {count} points
        · selected {selection || 'none'}
      </Text>
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
          disabled={!ready}
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
          title={below ? 'Route above labels' : 'Route below labels'}
          onPress={() => setBelow((v) => !v)}
        />
        <Button
          title="Remount"
          onPress={() => {
            setReady(false);
            setGeneration((v) => v + 1);
          }}
        />
      </View>
      <MapView
        key={generation}
        ref={camera}
        style={{ flex: 1 }}
        styleURL="https://tiles.openfreemap.org/styles/liberty"
        initialCamera={{
          center: { latitude: 54.37, longitude: 18.66 },
          zoom: 12,
          heading: 0,
          pitch: 0,
        }}
        onMapReady={() => setReady(true)}
        onError={(e) => setSelection(e.code)}
      >
        <GeoJSONSource
          id="route"
          data={{ type: 'FeatureCollection', features: [route] }}
        >
          <Layer
            id="route-line"
            type="line"
            beforeId={below ? 'waterway_line_label' : undefined}
            style={{ lineColor: '#ef4274', lineWidth: 12, lineOpacity: 0.85 }}
          />
        </GeoJSONSource>
        <GeoJSONSource id="fleet" data={data} onPress={setSelection}>
          <Layer
            id="fleet-circles"
            type="circle"
            visible={visible}
            style={{ circleColor: '#145e99', circleRadius: 5 }}
          />
        </GeoJSONSource>
        <Circle
          id="harbor-circle"
          center={{ latitude: 54.37, longitude: 18.66 }}
          radius={450}
          fillColor="#16a08540"
          strokeColor="#16a085"
          strokeWidth={3}
          lineDashPattern={[9, 6]}
          tappable
          onPress={(e) => setSelection(e.nativeEvent.identifier)}
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
          onPress={(e) => setSelection(e.nativeEvent.identifier)}
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
          onPress={(e) => setSelection(e.nativeEvent.identifier)}
        />
      </MapView>
      <Text style={{ padding: 8 }}>
        MapLibre Native owns basemap and layer projection. This example imports
        only the core package. Public demo tiles require internet.
      </Text>
    </View>
  );
}
const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap' },
});
