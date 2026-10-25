import React, { useEffect, useRef, useState } from 'react';
import { Button, Text, TextInput, View, NativeModules } from 'react-native';
import { MapView, Marker } from 'react-native-enhanced-maps';
import { ShaderLayer } from 'react-native-enhanced-maps/shaders';
import type { MapViewRef } from 'react-native-enhanced-maps';
import {
  shaderSource,
  windCompute,
  windVertex,
  windFragment,
} from './webgpuShader';
const center = { latitude: 54.375, longitude: 18.665 };
export default function WebGPUPrototype() {
  const map = useRef<MapViewRef>(null);
  const [generation, setGeneration] = useState(0);
  const [alternateStyle, setAlternateStyle] = useState(false);
  const [placement, setPlacement] = useState<'below-labels' | 'above-labels'>(
    'below-labels',
  );
  const [wind, setWind] = useState(false);
  const [paused, setPaused] = useState(false);
  const [effect, setEffect] = useState(0);
  const [amber, setAmber] = useState(false);
  const [tilted, setTilted] = useState(false);
  const [visible, setVisible] = useState(true);
  const [second, setSecond] = useState(false);
  const [allowSoftwareAdapter, setAllowSoftwareAdapter] = useState(false);
  const [source, setSource] = useState(shaderSource);
  const [editing, setEditing] = useState(false);
  const [status, setStatus] = useState('Waiting for ShaderLayer');
  const evidence = useRef({ readyCount: 0, errors: [] as string[] });
  const report = (error: { message: string }) => {
    evidence.current.errors.push(error.message);
    if (evidence.current.errors.length > 40) evidence.current.errors.shift();
    setStatus(error.message);
  };
  useEffect(() => {
    if (!__DEV__) return;
    const target = globalThis as typeof globalThis & {
      __enhancedMapsShaderRecovery?: Map<string, () => void>;
      __enhancedMapsWebGPU?: unknown;
    };
    const api = {
      snapshot: () => ({
        ...evidence.current,
        errors: [...evidence.current.errors],
        diagnostics: NativeModules.EMShaderLayer?.diagnostics?.(),
      }),
      lose: () => {
        const inject =
          target.__enhancedMapsShaderRecovery?.get('animated-water');
        if (!inject) throw new Error('Shader device is not available');
        inject();
      },
      software: setAllowSoftwareAdapter,
      visible: setVisible,
      remount: () => setGeneration((value) => value + 1),
    };
    target.__enhancedMapsWebGPU = api;
    return () => {
      if (target.__enhancedMapsWebGPU === api)
        delete target.__enhancedMapsWebGPU;
    };
  }, []);
  const tint = amber ? [1, 0.45, 0.03, 0.85] : [0.04, 0.48, 0.95, 0.85];
  return (
    <View style={{ flex: 1 }}>
      <Text style={{ padding: 8 }}>
        ShaderLayer · {placement}
        {'\n'}
        {status}
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        <Button
          title={placement === 'below-labels' ? 'Above labels' : 'Below labels'}
          onPress={() =>
            setPlacement((v) =>
              v === 'below-labels' ? 'above-labels' : 'below-labels',
            )
          }
        />
        <Button
          title={paused ? 'Resume' : 'Pause'}
          onPress={() => setPaused((v) => !v)}
        />
        <Button
          title={['Waves', 'Radar', 'Checkerboard'][effect]}
          onPress={() => setEffect((v) => (v + 1) % 3)}
        />
        <Button
          title={amber ? 'Blue' : 'Amber'}
          onPress={() => setAmber((v) => !v)}
        />
        <Button
          title={visible ? 'Hide layer' : 'Show layer'}
          onPress={() => setVisible((v) => !v)}
        />
        <Button
          title={second ? 'Remove second' : 'Second layer'}
          onPress={() => setSecond((v) => !v)}
        />
        <Button
          title="Tilt / rotate"
          onPress={() => {
            map.current?.animateCamera(
              {
                center,
                zoom: 12,
                heading: tilted ? 0 : 45,
                pitch: tilted ? 0 : 50,
              },
              1000,
            );
            setTilted((v) => !v);
          }}
        />
        <Button
          title="Reload style"
          onPress={() => setAlternateStyle((v) => !v)}
        />
        <Button title="Remount" onPress={() => setGeneration((v) => v + 1)} />
        <Button
          title={editing ? 'Close editor' : 'Edit WGSL'}
          onPress={() => setEditing((v) => !v)}
        />
        <Button title="Reset shader" onPress={() => setSource(shaderSource)} />
      </View>
      <Button
        title={
          allowSoftwareAdapter
            ? 'Software diagnostics enabled'
            : 'Allow software GPU (diagnostic)'
        }
        onPress={() => setAllowSoftwareAdapter((v) => !v)}
      />
      <Button
        title={wind ? 'Procedural waves' : 'Wind particles'}
        onPress={() => setWind((v) => !v)}
      />
      {__DEV__ && (
        <Button
          title="Simulate device loss"
          onPress={() => {
            const target = globalThis as typeof globalThis & {
              __enhancedMapsShaderRecovery?: Map<string, () => void>;
            };
            const inject =
              target.__enhancedMapsShaderRecovery?.get('animated-water');
            if (inject) inject();
            else setStatus('Shader device is not available');
          }}
        />
      )}
      <Button
        title="Block JS 3s"
        onPress={() => {
          const before = NativeModules.EMShaderLayer.diagnostics();
          const end = Date.now() + 3000;
          while (Date.now() < end) {
            /* Worklet keeps submitting. */
          }
          const after = NativeModules.EMShaderLayer.diagnostics();
          setStatus(
            `${after.produced - before.produced} GPU frames published while main JS blocked for 3s`,
          );
        }}
      />
      <View style={{ flexDirection: 'row' }}>
        <Button
          title="World view"
          onPress={() =>
            map.current?.animateCamera(
              {
                center: { latitude: 0, longitude: 0 },
                zoom: 1,
                heading: 0,
                pitch: 0,
              },
              1200,
            )
          }
        />
        <Button
          title="Dateline"
          onPress={() =>
            map.current?.animateCamera(
              {
                center: { latitude: 0, longitude: 179.9 },
                zoom: 3,
                heading: 0,
                pitch: 0,
              },
              1200,
            )
          }
        />
        <Button
          title="Local view"
          onPress={() =>
            map.current?.animateCamera(
              { center, zoom: 12, heading: 0, pitch: 0 },
              1200,
            )
          }
        />
      </View>
      {editing && (
        <TextInput
          accessibilityLabel="WGSL source"
          multiline
          value={source}
          onChangeText={setSource}
          style={{ height: 140, fontSize: 10, borderWidth: 1 }}
        />
      )}
      <MapView
        key={generation}
        ref={map}
        style={{ flex: 1 }}
        styleURL={`https://tiles.openfreemap.org/styles/${alternateStyle ? 'bright' : 'liberty'}`}
        initialCamera={{ center, zoom: 12, heading: 0, pitch: 0 }}
        onError={report}
      >
        <ShaderLayer
          id="animated-water"
          shaders={
            wind
              ? {
                  vertex: windVertex,
                  fragment: windFragment,
                  compute: windCompute,
                }
              : { fragment: source }
          }
          {...(wind
            ? {
                simulation: {
                  byteLength: 1024 * 32,
                  workgroups: [16] as const,
                },
                vertexCount: 6,
                instanceCount: 1024,
              }
            : {})}
          placement={placement}
          paused={paused}
          visible={visible}
          uniforms={[effect, 0, 0, 0, ...tint]}
          allowSoftwareAdapter={allowSoftwareAdapter}
          onReady={() => {
            evidence.current.readyCount++;
            setStatus('ShaderLayer ready');
          }}
          onError={report}
        />
        {second && (
          <ShaderLayer
            id="second-effect"
            shaders={{ fragment: shaderSource }}
            uniforms={[1, 0, 0, 0, 1, 0.1, 0.3, 0.85]}
            allowSoftwareAdapter={allowSoftwareAdapter}
            onError={report}
          />
        )}
        <Marker id="webgpu-anchor" coordinate={center}>
          <View
            style={{ backgroundColor: '#bd2448', padding: 8, borderRadius: 6 }}
          >
            <Text style={{ color: '#ffffff' }}>Native marker</Text>
          </View>
        </Marker>
      </MapView>
    </View>
  );
}
