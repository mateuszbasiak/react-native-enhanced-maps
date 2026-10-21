import React, { useRef, useState } from 'react';
import { Button, Platform, Text, View } from 'react-native';
// Deliberately use the internal boundary: this spike defines no public shader API.
import NativeMap, {
  Commands,
} from '../../packages/maps/src/specs/MapLibreViewNativeComponent';
import NativeMarker from '../../packages/maps/src/specs/MarkerViewNativeComponent';
import { effects } from './effects';
import type { EffectName } from './effects';

const initialUniforms = {
  red: 0.04,
  green: 0.48,
  blue: 0.95,
  opacity: 1,
  speed: 1,
  parameters: [100, 0, 0, 0] as [number, number, number, number],
};
type Uniforms = typeof initialUniforms;

export default function ShaderPrototype() {
  const map = useRef<React.ElementRef<typeof NativeMap>>(null);
  const sequence = useRef(0);
  const [ready, setReady] = useState(false);
  const [generation, setGeneration] = useState(0);
  const [revision, setRevision] = useState(0);
  const [placement, setPlacement] = useState('below');
  const [paused, setPaused] = useState(false);
  const [tilted, setTilted] = useState(false);
  const [status, setStatus] = useState('Loading');
  const [effect, setEffect] = useState<EffectName>('waves');
  const [uniforms, setUniforms] = useState(initialUniforms);
  const send = (action: string, values = uniforms, effectName = effect) => {
    if (map.current)
      Commands.queryMap(
        map.current,
        ++sequence.current,
        JSON.stringify({
          kind: 'shaderPrototype',
          styleRevision: revision,
          action,
          uniforms: values,
          effectSource: effects[effectName],
        }),
      );
  };
  const configure = (patch: Partial<Uniforms>) => {
    const next = { ...uniforms, ...patch };
    setUniforms(next);
    send('configure', next);
  };
  if (Platform.OS !== 'ios')
    return (
      <Text>
        Metal spike: iOS only. Android needs a native C++ custom-layer host.
      </Text>
    );
  return (
    <View style={{ flex: 1 }}>
      <Text style={{ padding: 8 }}>
        Native Metal feasibility · {placement} labels ·{' '}
        {paused ? 'paused' : 'animated'}
        {'\n'}
        {status}
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        <Button
          title="Below labels"
          disabled={!ready}
          onPress={() => {
            setPlacement('below');
            setPaused(false);
            send('below');
          }}
        />
        <Button
          title="Above labels"
          disabled={!ready}
          onPress={() => {
            setPlacement('above');
            setPaused(false);
            send('above');
          }}
        />
        <Button
          title={paused ? 'Resume' : 'Pause'}
          disabled={!ready}
          onPress={() => {
            send(paused ? 'resume' : 'pause');
            setPaused(!paused);
          }}
        />
        <Button
          title="Remove"
          onPress={() => send('remove')}
          disabled={!ready}
        />
        <Button title="Stats" onPress={() => send('stats')} disabled={!ready} />
        <Button
          title={tilted ? 'Flat' : 'Tilt / rotate'}
          disabled={!ready}
          onPress={() => {
            if (map.current)
              Commands.animateCamera(
                map.current,
                54.375,
                18.665,
                12,
                tilted ? 0 : 45,
                tilted ? 0 : 50,
                1800,
              );
            setTilted(!tilted);
          }}
        />
        <Button
          title="Block JS 3s"
          disabled={!ready}
          onPress={() => {
            const end = Date.now() + 3000;
            while (Date.now() < end) {
              /* Deliberate contention test. */
            }
          }}
        />
        <Button
          title="Reload style"
          disabled={!ready}
          onPress={() => {
            setReady(false);
            setRevision((v) => v + 1);
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
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        <Button
          title="Blue"
          disabled={!ready}
          onPress={() => configure({ red: 0.04, green: 0.48, blue: 0.95 })}
        />
        <Button
          title="Amber"
          disabled={!ready}
          onPress={() => configure({ red: 1, green: 0.45, blue: 0.03 })}
        />
        <Button
          title="Purple"
          disabled={!ready}
          onPress={() => configure({ red: 0.65, green: 0.15, blue: 0.95 })}
        />
        <Button
          title={`Speed ${uniforms.speed}×`}
          disabled={!ready}
          onPress={() =>
            configure({
              speed: uniforms.speed === 1 ? 3 : uniforms.speed === 3 ? 0.3 : 1,
            })
          }
        />
        <Button
          title={`Detail ${uniforms.parameters[0]}`}
          disabled={!ready}
          onPress={() =>
            configure({
              parameters: [
                uniforms.parameters[0] === 100
                  ? 40
                  : uniforms.parameters[0] === 40
                    ? 200
                    : 100,
                0,
                0,
                0,
              ],
            })
          }
        />
        <Button
          title={`Opacity ${uniforms.opacity}`}
          disabled={!ready}
          onPress={() =>
            configure({ opacity: uniforms.opacity === 1 ? 0.35 : 1 })
          }
        />
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {(Object.keys(effects) as EffectName[]).map((name) => (
          <Button
            key={name}
            title={name === effect ? `${name} (active)` : name}
            disabled={!ready}
            onPress={() => {
              setEffect(name);
              send('configure', uniforms, name);
            }}
          />
        ))}
      </View>
      <NativeMap
        key={generation}
        ref={map}
        style={{ flex: 1 }}
        styleURL="https://tiles.openfreemap.org/styles/liberty"
        styleRevision={revision}
        initialLatitude={54.375}
        initialLongitude={18.665}
        initialZoom={12}
        onMapReady={() => {
          setReady(true);
          setPaused(false);
          send(placement);
        }}
        onMapError={({ nativeEvent }) => setStatus(nativeEvent.message)}
        onMapQueryResult={({ nativeEvent }) =>
          setStatus(nativeEvent.error || nativeEvent.resultJSON)
        }
      >
        <NativeMarker
          markerID="shader-anchor"
          latitude={54.375}
          longitude={18.665}
        >
          <View
            style={{ backgroundColor: '#bd2448', padding: 8, borderRadius: 6 }}
          >
            <Text style={{ color: '#ffffff', fontWeight: '700' }}>
              Native marker
            </Text>
          </View>
        </NativeMarker>
      </NativeMap>
    </View>
  );
}
