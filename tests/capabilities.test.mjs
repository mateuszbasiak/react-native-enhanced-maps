import { test } from 'node:test';
import assert from 'node:assert/strict';
const report = () => ({
  engine: 'maplibre',
  platform: 'android',
  shaders: 'unvalidated',
  detailedGestures: 'unvalidated',
  layers: {
    circle: 'unvalidated',
    line: 'unvalidated',
    fill: 'unvalidated',
    symbol: 'unsupported',
    raster: 'unvalidated',
    heatmap: 'unsupported',
  },
});
test('native capability reports preserve evidence states and freeze snapshots', async () => {
  const { parseCapabilities } =
    await import('../packages/maps/lib/capabilities.js');
  const parsed = parseCapabilities(JSON.stringify(report()), 'android');
  assert.deepEqual(parsed, report());
  assert.ok(Object.isFrozen(parsed));
  assert.ok(Object.isFrozen(parsed.layers));
  assert.throws(() => {
    parsed.layers.circle = 'supported';
  }, TypeError);
  const ios = { ...report(), platform: 'ios', shaders: 'supported' };
  assert.equal(
    parseCapabilities(JSON.stringify(ios), 'ios').shaders,
    'supported',
  );
});
test('native capability reports reject incomplete or mismatched payloads without inferring support', async () => {
  const { parseCapabilities } =
    await import('../packages/maps/lib/capabilities.js');
  for (const value of [
    null,
    [],
    {},
    { ...report(), platform: 'ios' },
    { ...report(), engine: 'google' },
    { ...report(), shaders: true },
    { ...report(), shaders: 'maybe' },
    { ...report(), extra: true },
    { ...report(), layers: { circle: 'supported' } },
    { ...report(), layers: { ...report().layers, custom: 'supported' } },
  ])
    assert.throws(
      () => parseCapabilities(JSON.stringify(value), 'android'),
      /capabilit/i,
    );
  assert.throws(() => parseCapabilities('{', 'android'), /capabilit/i);
  assert.throws(
    () => parseCapabilities(' '.repeat(4097), 'android'),
    /capabilit/i,
  );
});

test('both native hosts emit capability reports accepted by the public parser', async () => {
  const { execFileSync } = await import('node:child_process');
  const { mkdirSync } = await import('node:fs');
  const { default: path } = await import('node:path');
  const { parseCapabilities } =
    await import('../packages/maps/lib/capabilities.js');
  const output = path.resolve('artifacts/native-tests');
  mkdirSync(output, { recursive: true });
  execFileSync('javac', [
    '-d',
    output,
    'packages/maps/android/src/main/java/com/enhancedmaps/NativeMapCapabilities.java',
    'tests/native/NativeMapCapabilitiesTest.java',
  ]);
  const android = execFileSync(
    'java',
    ['-cp', output, 'NativeMapCapabilitiesTest'],
    { encoding: 'utf8' },
  );
  assert.deepEqual(parseCapabilities(android, 'android'), report());
  const binary = path.join(output, 'native-map-capabilities');
  execFileSync('c++', [
    '-std=c++17',
    '-Ipackages/maps/ios',
    'tests/native/NativeMapCapabilitiesTest.cpp',
    '-o',
    binary,
  ]);
  const ios = execFileSync(binary, [], { encoding: 'utf8' });
  assert.deepEqual(parseCapabilities(ios, 'ios'), {
    ...report(),
    platform: 'ios',
  });
});

test('readiness ignores queued reports from old style requests and detached maps', async () => {
  const { createMapReadiness } =
    await import('../packages/maps/lib/capabilities.js');
  const state = createMapReadiness('android');
  const json = JSON.stringify(report());
  assert.equal(state.getCapabilities(), null);
  state.activate(0);
  state.activate(1); // B committed while A's ready event is queued.
  assert.equal(state.acceptReport(0, json), null);
  assert.equal(state.getCapabilities(), null);
  assert.deepEqual(state.acceptReport(1, json), report());
  assert.deepEqual(state.getCapabilities(), report());
  state.activate(2); // A again: matching URLs cannot identify a request.
  assert.equal(state.acceptReport(0, json), null);
  assert.equal(state.getCapabilities(), null);
  state.acceptReport(2, json);
  state.invalidate();
  assert.equal(state.getCapabilities(), null);
  state.deactivate();
  assert.equal(state.acceptReport(2, json), null);
  state.activate(3);
  assert.equal(state.acceptReport(2, json), null);
  assert.deepEqual(state.acceptReport(3, json), report());
});
