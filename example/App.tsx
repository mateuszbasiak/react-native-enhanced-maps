import React, { useEffect, useRef, useState } from 'react';
import { Button, Platform, SafeAreaView, StatusBar, View } from 'react-native';
import MapSettingsVerification from './verification/MapSettingsVerification';
import CustomMarkers from './markers/CustomMarkersPrototype';
import MapDemo from './maplibre/MapLibrePrototype';
import RuntimeVerification from './verification/RuntimeVerification';
import ClusterVerification from './verification/ClusterVerification';
import LifecycleVerification from './verification/LifecycleVerification';
import ShapePickingVerification from './verification/ShapePickingVerification';
import GradientVerification from './verification/GradientVerification';
import ShaderPrototype from './gpu/ShaderPrototype';
import WebGPUPrototype from './gpu/WebGPUPrototype';
import {
  createScenarioSession,
  scenarios,
} from './verification/scenarioSession';
import type { Scenario, Selection } from './verification/scenarioSession';
import { inspectScenario } from './verification/scenarioAdapters';
type Session = ReturnType<typeof createScenarioSession>;
type DebugGlobal = typeof globalThis & {
  __enhancedMapsScenarios?: Pick<
    Session,
    'select' | 'selection' | 'collect'
  > & { scenarios: typeof scenarios };
};
const controls: readonly [Scenario, string][] = [
  ['settings', 'settings'],
  ['runtime', 'verification'],
  ['clusters', 'clustering'],
  ['lifecycle', 'lifecycle'],
  ['shader', 'GPU prototype'],
  ['webgpu', 'WebGPU prototype'],
  ['shape-picking', 'shape picking'],
  ['gradients', 'gradients'],
];
export default function App() {
  const [selection, setSelection] = useState<Selection>({
    id: 'markers',
    generation: 0,
  });
  const session = useRef<Session | null>(null);
  useEffect(() => {
    if (!__DEV__) return;
    const version = Platform.constants.reactNativeVersion;
    const instance = createScenarioSession({
      environment: {
        platform: Platform.OS,
        os: String(Platform.Version),
        reactNative: `${version.major}.${version.minor}.${version.patch}`,
        sdkBaseline: Platform.OS === 'ios' ? '6.31.0' : '13.6.1',
        buildMode: 'Debug',
      },
      mount: setSelection,
      inspect: inspectScenario,
      now: () =>
        (
          globalThis as unknown as { performance: { now(): number } }
        ).performance.now(),
      sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    });
    session.current = instance;
    const target = globalThis as DebugGlobal;
    const api = {
      select: instance.select,
      selection: instance.selection,
      collect: instance.collect,
      scenarios,
    };
    target.__enhancedMapsScenarios = api;
    instance.select('markers');
    return () => {
      instance.dispose();
      if (session.current === instance) session.current = null;
      if (target.__enhancedMapsScenarios === api)
        delete target.__enhancedMapsScenarios;
    };
  }, []);
  useEffect(() => {
    session.current?.acknowledge(selection.generation);
  }, [selection.generation]);
  const navigate = (id: Scenario) => {
    if (__DEV__ && session.current) session.current.select(id);
    else setSelection((old) => ({ id, generation: old.generation + 1 }));
  };
  const id = selection.id;
  return (
    <SafeAreaView
      style={{
        flex: 1,
        paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
      }}
    >
      <Button
        title={id === 'shapes' ? 'Show custom markers' : 'Show native layers'}
        onPress={() => navigate(id === 'shapes' ? 'markers' : 'shapes')}
      />
      {__DEV__ &&
        controls.map(([scenario, label]) => (
          <Button
            key={scenario}
            title={`${id === scenario ? 'Close' : 'Open'} ${label}`}
            onPress={() => navigate(id === scenario ? 'markers' : scenario)}
          />
        ))}
      <View key={selection.generation} style={{ flex: 1 }}>
        {id === 'gradients' && __DEV__ ? (
          <GradientVerification />
        ) : id === 'shape-picking' && __DEV__ ? (
          <ShapePickingVerification />
        ) : id === 'lifecycle' && __DEV__ ? (
          <LifecycleVerification />
        ) : id === 'settings' && __DEV__ ? (
          <MapSettingsVerification />
        ) : id === 'webgpu' && __DEV__ ? (
          <WebGPUPrototype />
        ) : id === 'shader' && __DEV__ ? (
          <ShaderPrototype />
        ) : id === 'clusters' && __DEV__ ? (
          <ClusterVerification />
        ) : id === 'runtime' && __DEV__ ? (
          <RuntimeVerification />
        ) : id === 'shapes' ? (
          <MapDemo />
        ) : (
          <CustomMarkers />
        )}
      </View>
    </SafeAreaView>
  );
}
