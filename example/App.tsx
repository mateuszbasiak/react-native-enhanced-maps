import React, { useEffect, useRef, useState } from 'react';
import {
  Button,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import MapSettingsVerification from './verification/MapSettingsVerification';
import CustomMarkers from './markers/CustomMarkersPrototype';
import MapDemo from './maplibre/MapLibrePrototype';
import RuntimeVerification from './verification/RuntimeVerification';
import ClusterVerification from './verification/ClusterVerification';
import LifecycleVerification from './verification/LifecycleVerification';
import NativeSceneVerification from './verification/NativeSceneVerification';
import ShapePickingVerification from './verification/ShapePickingVerification';
import GradientVerification from './verification/GradientVerification';
import FitVerification from './verification/FitVerification';
import CalloutVerification from './verification/CalloutVerification';
import ShaderPrototype from './gpu/ShaderPrototype';
import WebGPUPrototype from './gpu/WebGPUPrototype';
import ShaderLifecycleVerification from './gpu/ShaderLifecycleVerification';
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
  ['callouts', 'Marker callouts'],
  ['fit', 'Dateline fits'],
  ['settings', 'settings'],
  ['runtime', 'verification'],
  ['native-scene', 'Native scene validation'],
  ['clusters', 'clustering'],
  ['lifecycle', 'lifecycle'],
  ['shader', 'GPU prototype'],
  ['webgpu', 'WebGPU prototype'],
  ['shader-lifecycle', 'Shader lifecycle'],
  ['shape-picking', 'shape picking'],
  ['gradients', 'gradients'],
];
export default function App() {
  const [selection, setSelection] = useState<Selection>({
    id: 'markers',
    generation: 0,
  });
  const [pickerOpen, setPickerOpen] = useState(false);
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
  const examples: readonly [Scenario, string][] = [
    ['markers', 'Custom markers'],
    ['shapes', 'Native layers'],
    ...(__DEV__ ? controls : []),
  ];
  const title = examples.find(([scenario]) => scenario === id)?.[1] ?? id;
  return (
    <SafeAreaView
      style={{
        flex: 1,
        paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
      }}
    >
      <View style={styles.header}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <Button title="Examples" onPress={() => setPickerOpen(true)} />
      </View>
      <View key={selection.generation} style={{ flex: 1 }}>
        {id === 'callouts' && __DEV__ ? (
          <CalloutVerification />
        ) : id === 'native-scene' && __DEV__ ? (
          <NativeSceneVerification />
        ) : id === 'fit' && __DEV__ ? (
          <FitVerification />
        ) : id === 'gradients' && __DEV__ ? (
          <GradientVerification />
        ) : id === 'shape-picking' && __DEV__ ? (
          <ShapePickingVerification />
        ) : id === 'lifecycle' && __DEV__ ? (
          <LifecycleVerification />
        ) : id === 'settings' && __DEV__ ? (
          <MapSettingsVerification />
        ) : id === 'shader-lifecycle' && __DEV__ ? (
          <ShaderLifecycleVerification />
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
      <Modal
        visible={pickerOpen}
        animationType="slide"
        onRequestClose={() => setPickerOpen(false)}
      >
        <SafeAreaView
          style={{
            flex: 1,
            backgroundColor: '#fff',
            paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
          }}
        >
          <View style={styles.header}>
            <Text style={styles.title} accessibilityRole="header">
              Choose example
            </Text>
            <Button title="Close" onPress={() => setPickerOpen(false)} />
          </View>
          <ScrollView>
            {examples.map(([scenario, label]) => (
              <Pressable
                key={scenario}
                accessibilityRole="button"
                accessibilityState={{ selected: id === scenario }}
                onPress={() => {
                  if (id !== scenario) navigate(scenario);
                  setPickerOpen(false);
                }}
                style={[styles.option, id === scenario && styles.selected]}
              >
                <Text style={styles.optionText}>
                  {label}
                  {id === scenario ? ' ✓' : ''}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    minHeight: 48,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ccd3da',
  },
  title: {
    flex: 1,
    fontSize: 17,
    fontWeight: '600',
    color: '#182b3a',
    textTransform: 'capitalize',
  },
  option: { padding: 18, minHeight: 52 },
  selected: { backgroundColor: '#e8f2fa' },
  optionText: { fontSize: 17, color: '#182b3a', textTransform: 'capitalize' },
});
