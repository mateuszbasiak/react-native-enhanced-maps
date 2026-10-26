import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState, Button, NativeModules, Text, View } from 'react-native';
import { createSynchronizable } from 'react-native-worklets';
import type { Synchronizable } from 'react-native-worklets';
import { MapView, Marker } from 'react-native-enhanced-maps';
import { ShaderLayer } from 'react-native-enhanced-maps/shaders';
import type { ShaderFrame } from 'react-native-enhanced-maps/shaders';
import ExampleControls from '../ExampleControls';
import { shaderSource } from './webgpuShader';
import { shaderMapReady, verifyShaderClock } from './shaderLifecycleEvidence';
import type { ShaderClockProbe } from './shaderLifecycleEvidence';
type MapID = 'a' | 'b';
type Config = {
  mounted: boolean;
  paused: boolean;
  alternateStyle: boolean;
  invalid: boolean;
  mount: number;
  epoch: number;
};
type Evidence = {
  readyCount: number;
  readyEpoch: number;
  mapReadyCount: number;
  mapReadyMount: number;
  mapReadyStyle: boolean;
};
const ids = ['a', 'b'] as const;
const initial = (): Config => ({
  mounted: true,
  paused: false,
  alternateStyle: false,
  invalid: false,
  mount: 0,
  epoch: 0,
});
const emptyClock = (): ShaderClockProbe => ({
  epoch: 0,
  frames: 0,
  time: 0,
  delta: 0,
});
function MapSlot({
  id,
  config,
  software,
  probe,
  ready,
  mapReady,
  error,
}: {
  id: MapID;
  config: Config;
  software: boolean;
  probe: Synchronizable<ShaderClockProbe>;
  ready: (id: MapID, epoch: number) => void;
  mapReady: (id: MapID, mount: number, style: boolean) => void;
  error: (id: MapID, epoch: number, error: { message: string }) => void;
}) {
  const epoch = config.epoch;
  const uniforms = useMemo(
    () => (frame: ShaderFrame) => {
      'worklet';
      probe.setBlocking((previous) => ({
        epoch,
        frames: previous.frames + 1,
        time: frame.time,
        delta: frame.delta,
      }));
      return id === 'a'
        ? [0, 0, 0, 0, 0.04, 0.48, 0.95, 0.85]
        : [0, 0, 0, 0, 1, 0.4, 0.03, 0.85];
    },
    [epoch, id, probe],
  );
  const center =
    id === 'a'
      ? { latitude: 54.375, longitude: 18.665 }
      : { latitude: 37.77, longitude: -122.42 };
  return (
    <View style={{ flex: 1 }}>
      <Text>
        Map {id.toUpperCase()} · epoch {epoch} ·{' '}
        {config.paused ? 'paused' : 'running'}
      </Text>
      {config.mounted ? (
        <MapView
          key={config.mount}
          style={{ flex: 1 }}
          initialCamera={{ center, zoom: 12, heading: 0, pitch: 0 }}
          styleURL={`https://tiles.openfreemap.org/styles/${config.alternateStyle ? 'bright' : 'liberty'}`}
          onMapReady={() => mapReady(id, config.mount, config.alternateStyle)}
          onError={(value) => error(id, epoch, value)}
        >
          <ShaderLayer
            id={`lifecycle-${id}`}
            shaders={{
              fragment: config.invalid
                ? 'deliberately invalid WGSL'
                : shaderSource,
            }}
            paused={config.paused}
            uniforms={uniforms}
            allowSoftwareAdapter={software}
            onReady={() => ready(id, epoch)}
            onError={(value) => error(id, epoch, value)}
          />
          <Marker id={`lifecycle-anchor-${id}`} coordinate={center}>
            <View
              style={{
                backgroundColor: id === 'a' ? '#165cbb' : '#ad4c07',
                padding: 6,
              }}
            >
              <Text style={{ color: 'white' }}>Map {id.toUpperCase()}</Text>
            </View>
          </Marker>
        </MapView>
      ) : (
        <Text>Map removed</Text>
      )}
    </View>
  );
}
export default function ShaderLifecycleVerification() {
  const [state, setState] = useState({
    software: false,
    maps: { a: initial(), b: initial() },
  });
  const latest = useRef(state);
  latest.current = state;
  const evidence = useRef<Record<MapID, Evidence>>({
    a: {
      readyCount: 0,
      readyEpoch: -1,
      mapReadyCount: 0,
      mapReadyMount: -1,
      mapReadyStyle: false,
    },
    b: {
      readyCount: 0,
      readyEpoch: -1,
      mapReadyCount: 0,
      mapReadyMount: -1,
      mapReadyStyle: false,
    },
  });
  const errors = useRef<{ id: MapID; epoch: number; message: string }[]>([]);
  const transitions = useRef<
    { state: string; at: number; probes: Record<MapID, ShaderClockProbe> }[]
  >([]);
  const [status, setStatus] = useState('Waiting for shader maps');
  const probes = useMemo(
    () => ({
      a: createSynchronizable(emptyClock()),
      b: createSynchronizable(emptyClock()),
    }),
    [],
  );
  const ready = (id: MapID, epoch: number) => {
    evidence.current[id].readyCount++;
    evidence.current[id].readyEpoch = epoch;
    setStatus(`Map ${id.toUpperCase()} ready · epoch ${epoch}`);
  };
  const mapReady = (id: MapID, mount: number, style: boolean) => {
    evidence.current[id].mapReadyCount++;
    evidence.current[id].mapReadyMount = mount;
    evidence.current[id].mapReadyStyle = style;
  };
  const error = (id: MapID, epoch: number, value: { message: string }) => {
    errors.current.push({ id, epoch, message: value.message.slice(0, 1024) });
    if (errors.current.length > 20) errors.current.shift();
    setStatus(`Map ${id.toUpperCase()}: ${value.message.slice(0, 120)}`);
  };
  const change = useCallback(
    (id: MapID, patch: Partial<Config>, resource = true) =>
      setState((previous) => {
        if (!ids.includes(id)) throw new Error('Unknown lifecycle map');
        const old = previous.maps[id];
        if (
          Object.entries(patch).every(
            ([key, value]) => old[key as keyof Config] === value,
          )
        )
          return previous;
        return {
          ...previous,
          maps: {
            ...previous.maps,
            [id]: { ...old, ...patch, epoch: old.epoch + (resource ? 1 : 0) },
          },
        };
      }),
    [],
  );
  useEffect(() => {
    if (!__DEV__) return;
    const target = globalThis as typeof globalThis & {
      __enhancedMapsShaderLifecycle?: unknown;
    };
    const subscription = AppState.addEventListener('change', (state) => {
      transitions.current.push({
        state,
        at: Date.now(),
        probes: {
          a: { ...probes.a.getBlocking() },
          b: { ...probes.b.getBlocking() },
        },
      });
      if (transitions.current.length > 12) transitions.current.shift();
    });
    const api = {
      snapshot: () => {
        const current = latest.current;
        const diagnostics = NativeModules.EMShaderLayer?.diagnostics?.() as
          { pools: number; produced: number; sampled: number } | undefined;
        const maps = Object.fromEntries(
          ids.map((id) => [
            id,
            {
              ...current.maps[id],
              ...evidence.current[id],
              probe: { ...probes[id].getBlocking() },
            },
          ]),
        ) as Record<MapID, Config & Evidence & { probe: ShaderClockProbe }>;
        const currentErrors = errors.current.filter(
          (value) =>
            current.maps[value.id].mounted &&
            current.maps[value.id].epoch === value.epoch,
        );
        const mounted = ids.filter((id) => maps[id].mounted);
        return {
          ready:
            mounted.length > 0 &&
            mounted.every((id) => shaderMapReady(maps[id])) &&
            diagnostics?.pools === mounted.length &&
            diagnostics.sampled > 0 &&
            currentErrors.length === 0,
          appState: AppState.currentState,
          software: current.software,
          maps,
          diagnostics,
          errors: [...currentErrors],
          history: [...errors.current],
          transitions: [...transitions.current],
        };
      },
      software: (value: boolean) =>
        setState((previous) =>
          previous.software === value
            ? previous
            : {
                software: value,
                maps: {
                  a: { ...previous.maps.a, epoch: previous.maps.a.epoch + 1 },
                  b: { ...previous.maps.b, epoch: previous.maps.b.epoch + 1 },
                },
              },
        ),
      pause: (id: MapID, value: boolean) =>
        change(id, { paused: value }, false),
      mounted: (id: MapID, value: boolean) => change(id, { mounted: value }),
      style: (id: MapID, value: boolean) =>
        change(id, { alternateStyle: value }),
      invalid: (id: MapID, value: boolean) => change(id, { invalid: value }),
      remount: (id: MapID) =>
        setState((previous) => ({
          ...previous,
          maps: {
            ...previous.maps,
            [id]: {
              ...previous.maps[id],
              mount: previous.maps[id].mount + 1,
              epoch: previous.maps[id].epoch + 1,
            },
          },
        })),
      clock: verifyShaderClock,
    };
    target.__enhancedMapsShaderLifecycle = api;
    return () => {
      subscription.remove();
      if (target.__enhancedMapsShaderLifecycle === api)
        delete target.__enhancedMapsShaderLifecycle;
    };
  }, [change, probes]);
  return (
    <View style={{ flex: 1 }}>
      <Text numberOfLines={2}>{status}</Text>
      <ExampleControls>
        <Button
          title={
            state.software
              ? 'Software diagnostics enabled'
              : 'Allow software GPU (diagnostic)'
          }
          onPress={() =>
            setState((previous) => ({
              software: !previous.software,
              maps: {
                a: { ...previous.maps.a, epoch: previous.maps.a.epoch + 1 },
                b: { ...previous.maps.b, epoch: previous.maps.b.epoch + 1 },
              },
            }))
          }
        />
        <Button
          title={state.maps.a.paused ? 'Resume A' : 'Pause A'}
          onPress={() => change('a', { paused: !state.maps.a.paused }, false)}
        />
        <Button
          title="Reload style A"
          onPress={() =>
            change('a', { alternateStyle: !state.maps.a.alternateStyle })
          }
        />
        <Button
          title={state.maps.b.mounted ? 'Remove map B' : 'Mount map B'}
          onPress={() => change('b', { mounted: !state.maps.b.mounted })}
        />
        <Button
          title={state.maps.a.invalid ? 'Restore WGSL A' : 'Invalid WGSL A'}
          onPress={() => change('a', { invalid: !state.maps.a.invalid })}
        />
      </ExampleControls>
      {ids.map((id) => (
        <MapSlot
          key={id}
          id={id}
          config={state.maps[id]}
          software={state.software}
          probe={probes[id]}
          ready={ready}
          mapReady={mapReady}
          error={error}
        />
      ))}
    </View>
  );
}
