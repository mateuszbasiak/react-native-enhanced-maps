import React, { useEffect, useMemo, useRef, useState } from 'react';
import { NativeModules, Text, View } from 'react-native';
import { MapView, Marker, Circle } from 'react-native-maplibre-maps';
import type { Camera, MapViewRef } from 'react-native-maplibre-maps';
import { ShaderLayer } from 'react-native-maplibre-maps/shaders';
import { gustkitField } from './gustkitField';

const reference = [
  [0, 0],
  [-1, 0],
  [1, 0],
  [0, 1],
] as const;
const fragment = /* wgsl */ `
@group(0) @binding(1) var<uniform> display:vec4f;
@group(0) @binding(2) var<storage,read> state:array<vec4f>;
fn mercator(lnglat:vec2f)->vec2f {
 return vec2f((lnglat.x+180.0)/360.0,(1.0-log(tan(0.7853981633974483+lnglat.y*0.008726646259971648))/3.141592653589793)*0.5);
}
@fragment fn fragmentMain(@location(0) @interpolate(linear) uv:vec2f,@location(1) world:vec2f)->@location(0) vec4f {
 let detail=mapSampleField_detail(world);
 let backdrop=mapSampleField_backdrop(world);
 let sample=select(backdrop.value,detail.value,detail.valid>0.5);
 let points=array<vec2f,4>(vec2f(0,0),vec2f(-1,0),vec2f(1,0),vec2f(0,1));
 for(var i=0u;i<4u;i++) {
  let projected=mapScreenPosition(mercator(points[i]));
  let targetUV=projected.xy/projected.w*vec2f(0.5,-0.5)+vec2f(0.5);
  let d=abs((uv-targetUV)*frame.resolution);
  if((d.x<1.5*frame.pixelRatio && d.y<7.0*frame.pixelRatio) || (d.y<1.5*frame.pixelRatio && d.x<7.0*frame.pixelRatio)) {
   if(state[0].x>0.0 && sample.x>0.0) { return vec4f(0,display.x,0,display.x); }
   return vec4f(0,0,display.x,display.x);
  }
 }
 return vec4f(0);
}`;
const compute = /* wgsl */ `
@group(0) @binding(2) var<storage,read_write> state:array<vec4f>;
@compute @workgroup_size(1) fn computeMain() {
 let d=mapSampleField_detail(vec2f(0.5));
 let b=mapSampleField_backdrop(vec2f(0.5));
 state[0]=vec4f(select(b.value,d.value,d.valid>0.5),d.scalar,d.scalarValid);
}`;
const initial = {
  revision: 0,
  opacity: 1,
  scale: 1,
  placement: 'above-labels' as 'above-labels' | 'below-labels',
  software: false,
  padded: false,
  height: 1,
  paused: false,
  visible: true,
  markers: true,
  shape: false,
};
export default function ShaderFieldVerification() {
  const map = useRef<MapViewRef>(null);
  const evidence = useRef({
    ready: 0,
    shaderReady: 0,
    errors: [] as string[],
    presses: [] as string[],
  });
  const [options, setOptions] = useState(initial);
  const latest = useRef(options);
  latest.current = options;
  const fields = useMemo(() => {
    const sign = options.revision % 2 ? -1 : 1;
    const detail = gustkitField({
      west: -2,
      south: -2,
      stepX: 2,
      stepY: 2,
      width: 3,
      height: 3,
      u: new Float32Array(9).fill(sign * 3),
      v: new Float32Array(9).fill(4),
      scalar: new Float32Array(9).fill(8),
    });
    const backdrop = gustkitField({
      west: -180,
      south: -80,
      stepX: 90,
      stepY: 40,
      width: 5,
      height: 5,
      u: new Float32Array(25).fill(sign * 3),
      v: new Float32Array(25).fill(4),
      scalar: null,
    });
    return { detail, backdrop };
  }, [options.revision]);
  useEffect(() => {
    if (!__DEV__) return;
    const target = globalThis as typeof globalThis & {
      __enhancedMapsShaderFields?: unknown;
    };
    const api = {
      clear: () => {
        evidence.current.errors = [];
        evidence.current.presses = [];
      },
      snapshot: () => ({
        ...evidence.current,
        errors: [...evidence.current.errors],
        presses: [...evidence.current.presses],
        options: latest.current,
        diagnostics: NativeModules.EMShaderLayer?.diagnostics?.(),
      }),
      configure: (next: Partial<typeof initial>) =>
        setOptions((old) => ({ ...old, ...next })),
      camera: (camera: Partial<Camera>) =>
        map.current?.animateCamera(camera, 0),
      project: (latitude: number, longitude: number) =>
        map.current?.pointForCoordinate({ latitude, longitude }),
      bounds: () => map.current?.getMapBoundaries(),
    };
    target.__enhancedMapsShaderFields = api;
    return () => {
      if (target.__enhancedMapsShaderFields === api)
        delete target.__enhancedMapsShaderFields;
    };
  }, []);
  return (
    <View style={{ flex: 1 }}>
      <Text>
        Shader field reference · magenta markers / green or blue GPU crosses
      </Text>
      <MapView
        ref={map}
        style={{ flex: options.height }}
        styleURL="http://localhost:8107/style.json"
        initialCamera={{
          center: { latitude: 0, longitude: 0 },
          zoom: 6,
          heading: 0,
          pitch: 0,
        }}
        mapPadding={
          options.padded ? { top: 70, right: 35, bottom: 10, left: 5 } : 0
        }
        onMapReady={() => {
          evidence.current.ready++;
        }}
        onError={(error) => {
          evidence.current.errors.push(error.message);
        }}
        onPress={() => {
          evidence.current.presses.push('map');
        }}
      >
        <ShaderLayer
          id="field-reference"
          fields={fields}
          uniforms={[options.opacity ?? 1]}
          shaders={{ fragment, compute }}
          simulation={{ byteLength: 16, workgroups: [1] }}
          resolutionScale={options.scale}
          placement={options.placement}
          paused={options.paused}
          visible={options.visible}
          allowSoftwareAdapter={options.software}
          onReady={() => {
            evidence.current.shaderReady++;
          }}
          onError={(error) => {
            evidence.current.errors.push(error.message);
          }}
        />
        {options.shape && (
          <Circle
            center={{ latitude: 0, longitude: 1 }}
            radius={20000}
            tappable
            fillColor="#eeeeee"
            strokeWidth={0}
            onPress={() => {
              evidence.current.presses.push('shape');
            }}
          />
        )}
        {options.markers &&
          reference.map(([longitude, latitude], index) => (
            <Marker
              key={index}
              id={`reference-${index}`}
              anchor={{ x: 0.5, y: 0.5 }}
              coordinate={{ latitude, longitude }}
              onPress={() => {
                evidence.current.presses.push(`marker-${index}`);
              }}
            >
              <View
                style={{
                  width: 24,
                  height: 24,
                  borderWidth: 2,
                  borderColor: '#ff00ff',
                }}
              />
            </Marker>
          ))}
      </MapView>
      {options.height < 1 && <View style={{ flex: 1 - options.height }} />}
    </View>
  );
}
