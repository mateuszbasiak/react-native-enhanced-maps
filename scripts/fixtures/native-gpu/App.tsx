import React, { useEffect, useRef, useState } from 'react';
import { NativeModules, Pressable, Text, View } from 'react-native';
import { MapView, Marker } from 'react-native-maplibre-maps';
import type { MapViewRef } from 'react-native-maplibre-maps';
import { ShaderLayer } from 'react-native-maplibre-maps/shaders';

const fragment = `
@fragment fn fragmentMain(@location(0) @interpolate(linear) uv:vec2f)->@location(0) vec4f {
 if(uv.x<0.2 || uv.x>0.8 || uv.y<0.2 || uv.y>0.8) { discard; }
 let pulse=0.5+0.5*sin(frame.time*3.0);
 return vec4f(0.5*pulse,0.15,0.5*(1.0-pulse),0.65);
}`;
const center = { latitude: 54.37, longitude: 18.66 };
type Options = {
  visible: boolean;
  paused: boolean;
  invalid: boolean;
  software: boolean;
  mounted: boolean;
};
export default function App() {
  const map = useRef<MapViewRef>(null);
  const [options, setOptions] = useState<Options>({
    visible: true,
    paused: false,
    invalid: false,
    software: false,
    mounted: true,
  });
  const [status, setStatus] = useState('Waiting for packed map');
  const evidence = useRef({
    mapReady: 0,
    shaderReady: 0,
    errors: [] as string[],
    queries: 0,
  });
  const query = async () => {
    try {
      await map.current!.getCamera();
      evidence.current.queries++;
      setStatus(`Core query passed ${evidence.current.queries}`);
    } catch (error) {
      setStatus(String(error));
    }
  };
  useEffect(() => {
    if (!__DEV__) return;
    const target = globalThis as typeof globalThis & {
      __enhancedMapsPackedGPU?: unknown;
    };
    const api = {
      configure: (patch: Partial<Options>) =>
        setOptions((previous) => ({ ...previous, ...patch })),
      query,
      snapshot: () => ({
        ...evidence.current,
        errors: [...evidence.current.errors],
        options,
        diagnostics: NativeModules.EMShaderLayer?.diagnostics?.(),
      }),
    };
    target.__enhancedMapsPackedGPU = api;
    return () => {
      if (target.__enhancedMapsPackedGPU === api)
        delete target.__enhancedMapsPackedGPU;
    };
  }, [options]);
  const button = (title: string, action: () => void) => (
    <Pressable
      key={title}
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={action}
      style={{ padding: 10, backgroundColor: '#ddd', margin: 3 }}
    >
      <Text>{title}</Text>
    </Pressable>
  );
  return (
    <View
      style={{
        flex: 1,
        paddingTop: 50,
        paddingBottom: 25,
        backgroundColor: 'white',
      }}
    >
      <Text testID="packed-gpu-status">{status}</Text>
      <Text>{`Map ${evidence.current.mapReady} Shader ${evidence.current.shaderReady} Errors ${evidence.current.errors.length} Queries ${evidence.current.queries}`}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {button(options.paused ? 'Resume' : 'Pause', () =>
          setOptions({ ...options, paused: !options.paused }),
        )}
        {button(options.visible ? 'Hide' : 'Show', () =>
          setOptions({ ...options, visible: !options.visible }),
        )}
        {button(options.invalid ? 'Correct shader' : 'Invalid shader', () =>
          setOptions({ ...options, invalid: !options.invalid }),
        )}
        {button(options.software ? 'Hardware only' : 'Allow software', () =>
          setOptions({ ...options, software: !options.software }),
        )}
        {button(options.mounted ? 'Unmount map' : 'Mount map', () =>
          setOptions({ ...options, mounted: !options.mounted }),
        )}
        {button('Query core', () => {
          void query();
        })}
      </View>
      {options.mounted && (
        <MapView
          ref={map}
          style={{ flex: 1 }}
          styleURL="https://tiles.openfreemap.org/styles/liberty"
          initialCamera={{ center, zoom: 12, heading: 0, pitch: 0 }}
          onMapReady={() => {
            evidence.current.mapReady++;
            setStatus(`Packed map ready ${evidence.current.mapReady}`);
          }}
          onError={(error) => setStatus('Map error: ' + error.code)}
        >
          <Marker id="packed-marker" coordinate={center}>
            <Text style={{ backgroundColor: 'white' }}>Packed GPU map</Text>
          </Marker>
          <ShaderLayer
            id="packed-shader"
            shaders={{ fragment: options.invalid ? 'invalid WGSL' : fragment }}
            paused={options.paused}
            visible={options.visible}
            allowSoftwareAdapter={options.software}
            onReady={() => {
              evidence.current.shaderReady++;
              setStatus(`Packed shader ready ${evidence.current.shaderReady}`);
            }}
            onError={(error) => {
              evidence.current.errors.push(error.message);
              setStatus('Shader error: ' + error.message.slice(0, 100));
            }}
          />
        </MapView>
      )}
    </View>
  );
}
