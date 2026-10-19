import React, { useRef, useState } from 'react';
import { Button, Platform, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import MapView from 'react-native-enhanced-maps';
import type { Camera, MapProvider, MapViewRef } from 'react-native-enhanced-maps';

const initialCamera: Camera = { center: { latitude: 52.2297, longitude: 21.0122 }, zoom: 11, heading: 0, pitch: 0 };
export default function App() {
  const [provider, setProvider] = useState<MapProvider>(Platform.OS === 'ios' ? 'apple' : 'google');
  const [generation, setGeneration] = useState(0);
  const [mounted, setMounted] = useState(true);
  const [status, setStatus] = useState('loading');
  const [cameraCount, setCameraCount] = useState(0);
  const [lastError, setLastError] = useState('');
  const map = useRef<MapViewRef>(null);
  return <SafeAreaView style={styles.root}>
    <View style={styles.toolbar}>
      <Text style={styles.heading}>Enhanced Maps · feasibility</Text>
      <Text testID="map-status">{provider} / {status} / camera events: {cameraCount}</Text>
      {lastError !== '' && <Text testID="map-error">{lastError}</Text>}
      <View style={styles.buttons}>
        <Button title={mounted ? 'Unmount' : 'Mount'} onPress={() => { setMounted(!mounted); setLastError(''); setStatus(mounted ? 'unmounted' : 'loading'); }} />
        <Button title="Remount" onPress={() => { setGeneration(generation + 1); setLastError(''); setStatus('loading'); setCameraCount(0); }} />
        <Button title="Move" disabled={status !== 'ready'} onPress={() => map.current?.animateCamera({ ...initialCamera, zoom: 13, heading: 30 }, 500)} />
        {Platform.OS === 'ios' && <Button title={provider === 'apple' ? 'Google' : 'Apple'} onPress={() => { setProvider(provider === 'apple' ? 'google' : 'apple'); setLastError(''); setStatus('loading'); }} />}
      </View>
    </View>
    {mounted && <MapView key={`${provider}-${generation}`} ref={map} provider={provider} initialCamera={initialCamera} style={styles.map} testID="native-map"
      onMapReady={() => setStatus('ready')}
      onError={error => { setLastError(`${error.code}: ${error.message}`); if (error.fatal) setStatus('error'); }}
      onCameraChange={() => setCameraCount(count => count + 1)}
    />}
    <Text style={styles.footer}>Native map lifecycle spike. GPU layers and performance are not yet validated.</Text>
  </SafeAreaView>;
}
const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: '#fff' }, toolbar: { padding: 12 }, heading: { fontSize: 18, fontWeight: '600' }, buttons: { flexDirection: 'row', flexWrap: 'wrap' }, map: { flex: 1 }, footer: { padding: 10, fontSize: 12 } });
