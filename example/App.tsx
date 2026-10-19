import React, { useEffect, useRef, useState } from 'react';
import { Button, Platform, SafeAreaView, StatusBar, StyleSheet, Text, View } from 'react-native';
import 'react-native-webgpu';
import { renderTriangleRaster } from '@react-native-enhanced-maps/typegpu';
import type { ExperimentalRasterOverlay } from 'react-native-enhanced-maps';
import MapView from 'react-native-enhanced-maps';
import type { Camera, CameraEvent, MapProvider, MapViewRef } from 'react-native-enhanced-maps';

const initialCamera: Camera = { center: { latitude: 52.2297, longitude: 21.0122 }, zoom: 11, heading: 0, pitch: 0 };
export default function App() {
  const [rasterEnabled, setRasterEnabled] = useState(false);
  const [raster, setRaster] = useState<ExperimentalRasterOverlay>();
  const [shaderStatus, setShaderStatus] = useState('off');
  const [shaderColor, setShaderColor] = useState(false);
  const cameraStep = useRef(0);
  useEffect(() => {
    if (!rasterEnabled) { setRaster(undefined); setShaderStatus('off'); return; }
    const controller = new AbortController();
    setShaderStatus('rendering');
    renderTriangleRaster({ bounds: { north: 52.24, south: 52.22, west: 20.995, east: 21.03 }, color: shaderColor ? [0.95, 0.15, 0.55, 0.65] : [0.05, 0.6, 1, 0.65], signal: controller.signal })
      .then(result => { if (!controller.signal.aborted) { setRaster(result); setShaderStatus('ready'); } })
      .catch(() => { if (!controller.signal.aborted) { setRaster(undefined); setShaderStatus('GPU error'); } });
    return () => controller.abort();
  }, [rasterEnabled, shaderColor]);
  const [provider, setProvider] = useState<MapProvider>(Platform.OS === 'ios' ? 'apple' : 'google');
  const [generation, setGeneration] = useState(0);
  const [mounted, setMounted] = useState(true);
  const [status, setStatus] = useState('loading');
  const [cameraCount, setCameraCount] = useState(0);
  const [lastError, setLastError] = useState('');
  const [live, setLive] = useState(true);
  const [idleCount, setIdleCount] = useState(0);
  const diagnostics = useRef({ changes: [] as number[], idle: [] as number[], lastOrigin: 'unknown' });
  if (__DEV__) (globalThis as typeof globalThis & { __enhancedMapDiagnostics?: typeof diagnostics.current }).__enhancedMapDiagnostics = diagnostics.current;
  const record = (kind: 'changes' | 'idle', event: CameraEvent) => {
    diagnostics.current[kind].push(Date.now());
    if (diagnostics.current[kind].length > 256) diagnostics.current[kind].shift();
    diagnostics.current.lastOrigin = event.origin;
    if (kind === 'changes') setCameraCount(count => count + 1);
    else setIdleCount(count => count + 1);
  };
  const resetEvents = () => { setCameraCount(0); setIdleCount(0); diagnostics.current.changes = []; diagnostics.current.idle = []; };
  const map = useRef<MapViewRef>(null);
  if (__DEV__) (globalThis as typeof globalThis & { __enhancedMapScenario?: unknown }).__enhancedMapScenario = {
    snapshot: () => ({ provider, status, shaderStatus, rasterEnabled, live, color: shaderColor ? 'pink' : 'blue', changes: diagnostics.current.changes.length, idle: diagnostics.current.idle.length, rasterWidth: raster?.width ?? 0 }),
    shader: (enabled: boolean) => setRasterEnabled(enabled),
    color: (pink: boolean) => setShaderColor(pink),
    live: (enabled: boolean) => setLive(enabled),
    provider: (next: MapProvider) => { if (next !== provider) { setProvider(next); setStatus('loading'); } },
    remount: () => { setGeneration(value => value + 1); setStatus('loading'); resetEvents(); },
    move: (step: number) => {
      const steps = [{ zoom: 12, heading: 0, pitch: 0 }, { zoom: 13, heading: 90, pitch: 45 }, { zoom: 12, heading: 180, pitch: 60 }, { zoom: 11, heading: 0, pitch: 0 }];
      if (!Number.isInteger(step) || step < 0 || step >= steps.length) throw new RangeError('Camera step must be 0–3');
      map.current?.animateCamera({ ...initialCamera, ...steps[step]! }, 1000);
    },
  };

  return <SafeAreaView style={styles.root}>
    <View style={styles.toolbar}>
      <Text style={styles.heading}>Enhanced Maps · feasibility</Text>
      <Text testID="map-status">{provider} / {status} / changes: {cameraCount} / idle: {idleCount}</Text>
      {lastError !== '' && <Text testID="map-error">{lastError}</Text>}
      <Text testID="shader-status">Shader snapshot: {shaderStatus}</Text>
      <View style={styles.buttons}>
        <Button title={rasterEnabled ? 'Shader off' : 'Shader on'} onPress={() => setRasterEnabled(!rasterEnabled)} />
        <Button title="Shader color" disabled={!rasterEnabled} onPress={() => setShaderColor(!shaderColor)} />
        <Button title="Camera path" disabled={status !== 'ready'} onPress={() => {
          const steps = [{ zoom: 12, heading: 0, pitch: 0 }, { zoom: 13, heading: 90, pitch: 45 }, { zoom: 12, heading: 180, pitch: 60 }, { zoom: 11, heading: 0, pitch: 0 }];
          map.current?.animateCamera({ ...initialCamera, ...steps[cameraStep.current++ % steps.length]! }, 1000);
        }} />
        <Button title={mounted ? 'Unmount' : 'Mount'} onPress={() => { setMounted(!mounted); setLastError(''); setStatus(mounted ? 'unmounted' : 'loading'); }} />
        <Button title="Remount" onPress={() => { setGeneration(generation + 1); setLastError(''); setStatus('loading'); resetEvents(); }} />
        <Button title="Move" disabled={status !== 'ready'} onPress={() => map.current?.animateCamera({ ...initialCamera, zoom: 13, heading: 30 }, 500)} />
        {Platform.OS === 'ios' && <Button title={provider === 'apple' ? 'Google' : 'Apple'} onPress={() => { setProvider(provider === 'apple' ? 'google' : 'apple'); setLastError(''); setStatus('loading'); }} />}
        <Button title={live ? 'Live: on' : 'Live: off'} onPress={() => setLive(!live)} />
      </View>
    </View>
    {mounted && <MapView key={`${provider}-${generation}`} ref={map} provider={provider} initialCamera={initialCamera} style={styles.map} testID="native-map"
      {...(raster ? { experimentalRasterOverlay: raster } : {})}
      onMapReady={() => setStatus('ready')}
      onError={error => { setLastError(`${error.code}: ${error.message}`); if (error.fatal) setStatus('error'); }}
      onCameraIdle={event => record('idle', event)}
      {...(live ? { onCameraChange: (event: CameraEvent) => record('changes', event) } : {})}
    />}
    <Text style={styles.footer}>Experimental TypeGPU texture. Camera projection stays native; live shaders and depth are not validated.</Text>
  </SafeAreaView>;
}
const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: '#fff', paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight ?? 0 : 0 }, toolbar: { padding: 12 }, heading: { fontSize: 18, fontWeight: '600' }, buttons: { flexDirection: 'row', flexWrap: 'wrap' }, map: { flex: 1 }, footer: { padding: 10, fontSize: 12 } });
