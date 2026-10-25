import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const source = readFileSync(
  new URL('../example/verification/scenarioSession.ts', import.meta.url),
  'utf8',
);
const { createScenarioSession } = await import(
  'data:text/javascript;base64,' +
    Buffer.from(
      ts.transpileModule(source, {
        compilerOptions: {
          module: ts.ModuleKind.ESNext,
          target: ts.ScriptTarget.ES2022,
        },
      }).outputText,
    ).toString('base64')
);
const metadata = {
  sourceCommit: '1234567',
  nativeBuildCommit: 'abcdef0',
  device: 'test simulator',
  seed: 42,
};
const environment = {
  platform: 'ios',
  os: '26.1',
  reactNative: '0.85.3',
  sdkBaseline: '6.31.0',
  buildMode: 'Debug',
};
function fixture() {
  let clock = 0,
    observation,
    selection,
    advance = () => {};
  const session = createScenarioSession({
    environment,
    mount: (value) => {
      selection = value;
    },
    inspect: () => observation,
    now: () => clock,
    sleep: async (ms) => {
      clock += ms;
      advance();
    },
  });
  return {
    session,
    get selection() {
      return selection;
    },
    observe: (value) => {
      observation = value;
    },
    advance: (value) => {
      advance = value;
    },
  };
}
test('collection waits for the committed generation, freezes copied evidence and records readiness without a semantic pass', async () => {
  const f = fixture();
  const selected = f.session.select('settings');
  const evidence = { ready: 1, values: [1] };
  f.observe({ ready: true, evidence });
  let polls = 0;
  f.advance(() => {
    if (++polls === 2) f.session.acknowledge(selected.generation);
  });
  const result = await f.session.collect(metadata, 500);
  assert.equal(result.status, 'ready');
  assert.equal(result.durationMs, 100);
  assert.equal(result.scenario, 'settings');
  assert.equal(result.metadata.seed, 42);
  assert.deepEqual(result.environment, environment);
  evidence.values.push(2);
  assert.deepEqual(result.evidence.values, [1]);
  assert(Object.isFrozen(result.evidence.values));
  assert(!('passed' in result));
});
test('selecting the same scenario remounts and cannot use an old acknowledgement', async () => {
  const f = fixture();
  const first = f.session.select('runtime');
  f.session.acknowledge(first.generation);
  f.observe({ ready: true, evidence: { readyCount: 1 } });
  const second = f.session.select('runtime');
  assert(second.generation > first.generation);
  f.session.acknowledge(first.generation);
  assert.equal((await f.session.collect(metadata, 100)).status, 'timeout');
});
test('superseding or disposing a pending collection cancels it', async () => {
  for (const dispose of [false, true]) {
    const f = fixture();
    f.session.select('settings');
    f.advance(() =>
      dispose ? f.session.dispose() : f.session.select('shapes'),
    );
    assert.equal((await f.session.collect(metadata, 100)).status, 'cancelled');
    if (dispose) assert.throws(() => f.session.select('runtime'), /disposed/);
  }
});
test('missing readiness times out and unsupported scenarios skip explicitly', async () => {
  const f = fixture();
  const selected = f.session.select('runtime');
  f.session.acknowledge(selected.generation);
  f.observe({ ready: false, evidence: { readyCount: 0 } });
  assert.equal((await f.session.collect(metadata, 100)).status, 'timeout');
  f.session.select('shader');
  assert.equal((await f.session.collect(metadata)).status, 'skipped');
});
test('fixture errors, inspection failures and oversized evidence fail without copying exception payloads', async () => {
  const f = fixture();
  const selected = f.session.select('settings');
  f.session.acknowledge(selected.generation);
  f.observe({
    ready: true,
    error: 'reported fixture error',
    evidence: { errors: ['reported fixture error'] },
  });
  assert.equal((await f.session.collect(metadata)).status, 'failed');
  f.observe({ ready: true, evidence: { payload: 'x'.repeat(300000) } });
  const result = await f.session.collect(metadata);
  assert.equal(result.status, 'failed');
  assert(!JSON.stringify(result).includes('xxx'));
  const bad = createScenarioSession({
    environment,
    mount: () => {},
    inspect: () => {
      throw new Error('private runtime payload');
    },
    now: () => 0,
    sleep: async () => {},
  });
  const s = bad.select('settings');
  bad.acknowledge(s.generation);
  const error = await bad.collect(metadata);
  assert.equal(error.status, 'failed');
  assert(!JSON.stringify(error).includes('private runtime payload'));
});
test('invalid routes, metadata and deadlines reject before mounting or waiting', async () => {
  const f = fixture();
  assert.throws(() => f.session.select('unknown'), /scenario/);
  f.session.select('settings');
  for (const invalid of [
    { ...metadata, sourceCommit: 'not-a-commit' },
    { ...metadata, sourceCommit: 1234567 },
    { ...metadata, nativeBuildCommit: '' },
    { ...metadata, device: '' },
    { ...metadata, seed: -1 },
    { ...metadata, seed: 0.5 },
  ])
    await assert.rejects(f.session.collect(invalid), /metadata/);
  for (const timeout of [0, NaN, 60001, 1.5])
    await assert.rejects(f.session.collect(metadata, timeout), /timeout/);
});

test('collection retains only declared metadata fields', async () => {
  const f = fixture();
  f.session.select('shader');
  const result = await f.session.collect({
    ...metadata,
    privateToken: 'must not be copied',
  });
  assert.deepEqual(result.metadata, metadata);
});

test('readiness observed only after the deadline remains a timeout', async () => {
  let now = 0;
  let ready = false;
  const session = createScenarioSession({
    environment,
    mount: () => {},
    inspect: () => ({ ready, evidence: { ready } }),
    now: () => now,
    sleep: async () => {
      now = 200;
      ready = true;
    },
  });
  const selected = session.select('settings');
  session.acknowledge(selected.generation);
  const result = await session.collect(metadata, 100);
  assert.equal(result.status, 'timeout');
  assert.equal(result.durationMs, 200);
});

test('gradient scenario participates in bounded readiness collection', async () => {
  const f = fixture();
  const selected = f.session.select('gradients');
  f.session.acknowledge(selected.generation);
  f.observe({
    ready: true,
    evidence: { ready: true, configuration: { gradient: true } },
  });
  assert.equal((await f.session.collect(metadata)).status, 'ready');
});

test('shader lifecycle scenario collects current-epoch readiness without claiming semantic acceptance', async () => {
  const f = fixture();
  const selected = f.session.select('shader-lifecycle');
  f.session.acknowledge(selected.generation);
  f.observe({
    ready: true,
    evidence: {
      ready: true,
      diagnostics: { pools: 2, sampled: 1 },
      maps: { a: { epoch: 1 }, b: { epoch: 1 } },
    },
  });
  const result = await f.session.collect(metadata);
  assert.equal(result.status, 'ready');
  assert.equal(result.scenario, 'shader-lifecycle');
  assert.equal(result.evidence.diagnostics.pools, 2);
});
