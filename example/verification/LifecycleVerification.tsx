import ExampleControls from '../ExampleControls';
import React, { useEffect, useRef, useState } from 'react';
import { Button, Platform, Text, View } from 'react-native';
import { MapView } from 'react-native-enhanced-maps';
import type { MapError, MapViewRef } from 'react-native-enhanced-maps';

type Cycle = {
  generation: number;
  durationMs: number;
  staleRefRejected: boolean;
};
type Evidence = {
  platform: string;
  status: 'idle' | 'running' | 'passed' | 'failed' | 'cancelled';
  requested: number;
  cycles: Cycle[];
  errors: MapError[];
  failure?: string;
};
type DebugGlobal = typeof globalThis & {
  __enhancedMapsLifecycle?: {
    snapshot(): Evidence;
    run(count?: number): Promise<void>;
    cancel(): void;
  };
};

async function queryWithTimeout<T>(query: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      query,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error('Native query timeout')),
          5000,
        );
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

/** Correctness harness only: this does not measure native memory/resource drift. */
export default function LifecycleVerification() {
  const map = useRef<MapViewRef>(null);
  const alive = useRef(true);
  const cancelled = useRef(false);
  const running = useRef(false);
  const sequence = useRef(0);
  const ready = useRef(0);
  const evidence = useRef<Evidence>({
    platform: Platform.OS,
    status: 'idle',
    requested: 0,
    cycles: [],
    errors: [],
  });
  const [generation, setGeneration] = useState(0);
  const [summary, setSummary] = useState('Idle');
  const run = useRef<(count?: number) => Promise<void>>(async () => {});
  run.current = async (count = 100) => {
    if (running.current) throw new Error('Lifecycle run already active');
    if (!Number.isInteger(count) || count < 1 || count > 100)
      throw new RangeError('Cycle count must be 1–100');
    if (!alive.current) throw new Error('Lifecycle fixture disposed');
    running.current = true;
    cancelled.current = false;
    evidence.current = {
      platform: Platform.OS,
      status: 'running',
      requested: count,
      cycles: [],
      errors: [],
    };
    try {
      for (let index = 0; index < count; index++) {
        const previous = map.current;
        const currentGeneration = ++sequence.current;
        const started = Date.now();
        setGeneration(currentGeneration);
        setSummary(`Cycle ${index + 1}/${count}: waiting for map`);
        while (ready.current !== currentGeneration) {
          if (!alive.current || cancelled.current)
            throw new Error('Lifecycle run cancelled');
          if (Date.now() - started > 15000)
            throw new Error(
              `Map-ready timeout at generation ${currentGeneration}`,
            );
          if (evidence.current.errors.some((error) => error.fatal))
            throw new Error('Fatal native map error');
          await new Promise<void>((resolve) => setTimeout(resolve, 50));
        }
        let staleRefRejected = previous === null;
        if (previous) {
          try {
            await queryWithTimeout(previous.getVisibleBounds());
          } catch (error) {
            if (
              !(error instanceof Error) ||
              error.message !== 'Map is not ready'
            )
              throw error;
            staleRefRejected = true;
          }
        }
        if (!staleRefRejected)
          throw new Error('Replaced map ref still accepts native queries');
        const current = map.current;
        if (!current) throw new Error('Ready map has no ref');
        const bounds = await queryWithTimeout(current.getVisibleBounds());
        if (
          ![bounds.north, bounds.south, bounds.east, bounds.west].every(
            Number.isFinite,
          ) ||
          bounds.north < bounds.south
        )
          throw new Error('Invalid native bounds');
        if (!alive.current || cancelled.current)
          throw new Error('Lifecycle run cancelled');
        evidence.current.cycles.push({
          generation: currentGeneration,
          durationMs: Date.now() - started,
          staleRefRejected,
        });
        console.info(`EnhancedMaps lifecycle completed ${index + 1}/${count}`);
        setSummary(`Completed ${index + 1}/${count}`);
      }
      evidence.current.status = 'passed';
      setSummary(`Passed ${count} remount/query cycles`);
    } catch (error) {
      evidence.current.status =
        !alive.current || cancelled.current ? 'cancelled' : 'failed';
      evidence.current.failure = String(error);
      if (alive.current) setSummary(String(error));
      throw error;
    } finally {
      running.current = false;
    }
  };
  useEffect(() => {
    alive.current = true;
    if (!__DEV__) return;
    const target = globalThis as DebugGlobal;
    const api = {
      snapshot: () => evidence.current,
      run: (count?: number) => run.current(count),
      cancel: () => {
        cancelled.current = true;
      },
    };
    target.__enhancedMapsLifecycle = api;
    return () => {
      alive.current = false;
      cancelled.current = true;
      if (target.__enhancedMapsLifecycle === api)
        delete target.__enhancedMapsLifecycle;
    };
  }, []);
  return (
    <View style={{ flex: 1 }}>
      <Text testID="lifecycle-status">{summary}</Text>
      <ExampleControls>
        <Button
          title="Run 100 remount cycles"
          onPress={() => {
            void run.current().catch(() => {});
          }}
        />
        <Button
          title="Cancel lifecycle run"
          onPress={() => {
            cancelled.current = true;
          }}
        />
      </ExampleControls>
      <MapView
        key={generation}
        ref={map}
        style={{ flex: 1 }}
        styleURL="https://tiles.openfreemap.org/styles/liberty"
        initialCamera={{
          center: { latitude: 54.37, longitude: 18.66 },
          zoom: 12,
          heading: 0,
          pitch: 0,
        }}
        onMapReady={() => {
          ready.current = generation;
        }}
        onError={(error) => {
          evidence.current.errors.push(error);
          evidence.current.errors = evidence.current.errors.slice(-32);
        }}
      />
    </View>
  );
}
