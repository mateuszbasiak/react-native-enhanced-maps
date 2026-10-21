import React, { useState } from 'react';
import { Button, Pressable, StyleSheet, Text, View } from 'react-native';
import { MapView } from 'react-native-enhanced-maps';
import { Marker } from 'react-native-enhanced-maps';

const coordinate = { latitude: 54.37, longitude: 18.66 };
export function MarkerStackingDemo({ onBack }: { onBack: () => void }) {
  const [mode, setMode] = useState<'B' | 'A' | 'equal'>('B');
  const [showB, setShowB] = useState(true);
  const [generation, setGeneration] = useState(0);
  const [hits, setHits] = useState({ A: 0, B: 0 });
  const [last, setLast] = useState('none');
  const [ready, setReady] = useState(false);
  const za = mode === 'A' ? 20 : 0,
    zb = mode === 'B' ? 10 : mode === 'A' ? -10 : 0;
  const press = (name: 'A' | 'B') => {
    setLast(name);
    setHits((v) => ({ ...v, [name]: v[name] + 1 }));
  };
  return (
    <View style={{ flex: 1 }}>
      <Button title="Back to live markers" onPress={onBack} />
      <Text style={{ padding: 8 }} testID="marker-stack-status">
        Front: {!showB || mode === 'A' ? 'A' : 'B'} · z A {za}, B {zb} · last{' '}
        {last} · hits A {hits.A}, B {hits.B}
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        <Button title="A on top" onPress={() => setMode('A')} />
        <Button title="B on top" onPress={() => setMode('B')} />
        <Button title="Equal z" onPress={() => setMode('equal')} />
        <Button
          title={showB ? 'Hide B' : 'Show B'}
          onPress={() => setShowB((v) => !v)}
        />
        <Button
          title="Remount stack"
          onPress={() => {
            setReady(false);
            setGeneration((v) => v + 1);
          }}
        />
      </View>
      <Text style={{ padding: 8 }}>
        Tap the overlapping center. Equal values put later-mounted B on top.
        Orange A has an exposed border.
      </Text>
      <MapView
        key={generation}
        style={{ flex: 1 }}
        styleURL="https://tiles.openfreemap.org/styles/liberty"
        onMapReady={() => setReady(true)}
        initialCamera={{
          center: { latitude: 54.37, longitude: 18.66 },
          zoom: 13,
          heading: 0,
          pitch: 0,
        }}
      >
        {ready && (
          <>
            <Marker id="stack-a" coordinate={coordinate} zIndex={za}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Stack marker A"
                onPress={() => press('A')}
                style={[
                  styles.card,
                  { width: 180, height: 105, backgroundColor: '#a44912' },
                ]}
              >
                <Text style={styles.label}>Marker A</Text>
              </Pressable>
            </Marker>
            {showB && (
              <Marker id="stack-b" coordinate={coordinate} zIndex={zb}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Stack marker B"
                  onPress={() => press('B')}
                  style={[
                    styles.card,
                    { width: 140, height: 75, backgroundColor: '#145e99' },
                  ]}
                >
                  <Text style={styles.label}>Marker B</Text>
                </Pressable>
              </Marker>
            )}
          </>
        )}
      </MapView>
    </View>
  );
}
const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontWeight: '700', color: '#fff' },
});
