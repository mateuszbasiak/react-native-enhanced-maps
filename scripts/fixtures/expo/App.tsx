import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { MapView, Marker, Circle } from 'react-native-maplibre-maps';
export default function App() {
  const [ready, setReady] = useState(false);
  const [presses, setPresses] = useState(0);
  const [error, setError] = useState('');
  return (
    <View style={{ flex: 1, paddingTop: 60, paddingBottom: 30 }}>
      <Text testID="expo-map-status">
        {error || (ready ? 'Expo map ready' : 'Loading Expo map')}
      </Text>
      <Text testID="expo-marker-count">Marker presses: {presses}</Text>
      <MapView
        style={{ flex: 1 }}
        styleURL="https://demotiles.maplibre.org/style.json"
        initialCamera={{
          center: { latitude: 52.2, longitude: 21 },
          zoom: 12,
          heading: 0,
          pitch: 0,
        }}
        onMapReady={() => setReady(true)}
        onError={(e) => setError(e.code + ': ' + e.message)}
      >
        <Circle
          id="area"
          center={{ latitude: 52.2, longitude: 21 }}
          radius={600}
          fillColor="#16a08540"
          strokeColor="#16a085"
        />
        <Marker id="expo-marker" coordinate={{ latitude: 52.2, longitude: 21 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Expo marker"
            onPress={() => setPresses((n) => n + 1)}
          >
            <Text style={{ backgroundColor: 'white', padding: 12 }}>
              Packed Expo marker
            </Text>
          </Pressable>
        </Marker>
      </MapView>
    </View>
  );
}
