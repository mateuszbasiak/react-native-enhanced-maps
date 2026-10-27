export const scenarios = [
  'markers',
  'shapes',
  'settings',
  'runtime',
  'native-scene',
  'clusters',
  'lifecycle',
  'shape-picking',
  'gradients',
  'shader',
  'webgpu',
  'shader-lifecycle',
] as const;
export type Scenario = (typeof scenarios)[number];
export type Selection = Readonly<{ id: Scenario; generation: number }>;
export type RunMetadata = Readonly<{
  sourceCommit: string;
  nativeBuildCommit: string;
  device: string;
  seed: number;
}>;
export type Environment = Readonly<{
  platform: string;
  os: string;
  reactNative: string;
  sdkBaseline: string;
  buildMode: 'Debug';
}>;
export type Observation = { ready: boolean; evidence: unknown; error?: string };
type Options = {
  environment: Environment;
  mount: (selection: Selection) => void;
  inspect: (scenario: Scenario) => Observation | undefined;
  now: () => number;
  sleep: (ms: number) => Promise<void>;
};
const instrumented: readonly Scenario[] = [
  'native-scene',
  'shader-lifecycle',
  'shapes',
  'settings',
  'runtime',
  'clusters',
  'shape-picking',
  'gradients',
];
function immutable(value: unknown): unknown {
  if (value && typeof value === 'object') {
    for (const entry of Object.values(value)) immutable(entry);
    Object.freeze(value);
  }
  return value;
}
function copyEvidence(value: unknown): unknown {
  const json = JSON.stringify(value);
  // Bound characters and worst-case UTF-8 before parsing/cloning the record.
  if (json === undefined || json.length > 65536)
    throw new Error('Evidence exceeds collection bound');
  return immutable(JSON.parse(json));
}
/** Debug harness only. Readiness records never assert that semantic checks passed. */
export function createScenarioSession(options: Options) {
  let current: Selection = { id: 'markers', generation: 0 },
    committed = -1,
    disposed = false;
  const environment = Object.freeze({ ...options.environment });
  return {
    select(id: Scenario): Selection {
      if (disposed) throw new Error('Scenario session disposed');
      if (!scenarios.includes(id)) throw new Error('Unknown scenario');
      current = Object.freeze({ id, generation: current.generation + 1 });
      committed = -1;
      options.mount(current);
      return current;
    },
    acknowledge(generation: number) {
      if (!disposed && generation === current.generation)
        committed = generation;
    },
    selection: () => current,
    dispose() {
      disposed = true;
      committed = -1;
    },
    async collect(metadata: RunMetadata, timeoutMs = 10000) {
      if (
        !metadata ||
        typeof metadata.sourceCommit !== 'string' ||
        typeof metadata.nativeBuildCommit !== 'string' ||
        !/^[0-9a-f]{7,40}$/i.test(metadata.sourceCommit) ||
        !/^[0-9a-f]{7,40}$/i.test(metadata.nativeBuildCommit) ||
        typeof metadata.device !== 'string' ||
        !metadata.device.trim() ||
        metadata.device.length > 256 ||
        !Number.isInteger(metadata.seed) ||
        metadata.seed < 0 ||
        metadata.seed > 0xffffffff
      )
        throw new Error('Invalid run metadata');
      if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 60000)
        throw new Error('Invalid readiness timeout');
      const captured = current,
        started = options.now(),
        details = Object.freeze({
          sourceCommit: metadata.sourceCommit,
          nativeBuildCommit: metadata.nativeBuildCommit,
          device: metadata.device,
          seed: metadata.seed,
        });
      const result = (
        status: 'ready' | 'timeout' | 'cancelled' | 'failed' | 'skipped',
        reason?: string,
        evidence?: unknown,
      ) =>
        Object.freeze({
          schemaVersion: 1,
          scenario: captured.id,
          generation: captured.generation,
          status,
          durationMs: Math.max(0, options.now() - started),
          metadata: details,
          environment,
          ...(reason ? { reason } : {}),
          ...(evidence === undefined ? {} : { evidence }),
        });
      if (disposed) return result('cancelled', 'Session disposed');
      if (!instrumented.includes(captured.id))
        return result('skipped', 'Scenario has no readiness adapter');
      for (;;) {
        if (disposed || current.generation !== captured.generation)
          return result('cancelled', 'Scenario replaced or session disposed');
        const remaining = timeoutMs - (options.now() - started);
        if (remaining <= 0)
          return result('timeout', 'Map readiness deadline exceeded');
        if (committed === captured.generation) {
          try {
            const observation = options.inspect(captured.id);
            if (observation?.error)
              return result(
                'failed',
                'Fixture reported an error',
                copyEvidence(observation.evidence),
              );
            if (observation?.ready)
              return result(
                'ready',
                undefined,
                copyEvidence(observation.evidence),
              );
          } catch {
            return result(
              'failed',
              'Fixture inspection or evidence collection failed',
            );
          }
        }
        await options.sleep(Math.min(50, remaining));
      }
    },
  };
}
