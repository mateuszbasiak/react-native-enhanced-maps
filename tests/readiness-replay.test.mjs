import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMapReadiness } from '../packages/maps/lib/capabilities.js';
import { createReadinessReplay } from '../packages/maps/lib/readinessReplay.js';
const report = JSON.stringify({
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
const tick = () => new Promise((resolve) => setImmediate(resolve));
function fixture() {
  const ready = createMapReadiness('android'),
    replay = createReadinessReplay(ready),
    events = [],
    pending = [];
  const callbacks = {
    pause: () => events.push('pause'),
    recovered: () => events.push('recover'),
    invalid: () => events.push('invalid'),
    probe: () =>
      new Promise((resolve, reject) => pending.push({ resolve, reject })),
  };
  const setup = (revision = 0) => replay.activate(revision, callbacks);
  return { ready, replay, events, pending, setup };
}
test('initial mount waits for native readiness; replay requires a fresh native report', async () => {
  const f = fixture();
  let cleanup = f.setup();
  assert.equal(f.pending.length, 0);
  f.ready.acceptReport(0, report);
  cleanup();
  assert.equal(f.ready.getCapabilities(), null);
  cleanup = f.setup();
  assert.deepEqual(f.events, ['pause']);
  assert.equal(f.ready.isReady(0), false);
  f.pending[0].resolve(report);
  await tick();
  assert.equal(f.ready.isReady(0), true);
  assert.deepEqual(f.events, ['pause', 'recover']);
  cleanup();
});
test('resolved or pending old probes cannot restore a cleaned up activation', async () => {
  const f = fixture();
  let cleanup = f.setup();
  f.ready.acceptReport(0, report);
  cleanup();
  cleanup = f.setup();
  f.pending[0].resolve(report);
  cleanup();
  const next = f.setup();
  await tick();
  assert.equal(f.ready.isReady(0), false);
  assert.equal(f.pending.length, 2);
  f.pending[1].resolve(report);
  await tick();
  assert.equal(f.ready.isReady(0), true);
  next();
});
test('style changes and fatal invalidation cannot be revived by a recovery reply', async () => {
  const f = fixture();
  let cleanup = f.setup();
  f.ready.acceptReport(0, report);
  cleanup();
  cleanup = f.setup();
  f.ready.invalidate();
  f.pending[0].resolve(report);
  await tick();
  assert.equal(f.ready.isReady(0), false);
  assert.equal(f.events.includes('recover'), false);
  cleanup();
  f.setup(1);
  assert.equal(f.pending.length, 1);
  assert.equal(f.ready.acceptReport(0, report), null);
});
test('failed and invalid reports keep queries unavailable and report malformed capabilities', async () => {
  for (const outcome of ['failed', 'invalid', 'platform']) {
    const f = fixture();
    let cleanup = f.setup();
    f.ready.acceptReport(0, report);
    cleanup();
    cleanup = f.setup();
    if (outcome === 'failed') f.pending[0].reject(Error('Map is not ready'));
    else
      f.pending[0].resolve(
        outcome === 'invalid' ? '{}' : report.replace('android', 'ios'),
      );
    await tick();
    assert.equal(f.ready.isReady(0), false);
    assert.equal(f.events.includes('recover'), false);
    assert.equal(f.events.includes('invalid'), outcome !== 'failed');
    cleanup();
  }
});
test('a newer native ready event wins over an outstanding recovery', async () => {
  const f = fixture();
  const cleanup = f.setup();
  f.ready.acceptReport(0, report);
  cleanup();
  f.setup();
  f.ready.acceptReport(0, report);
  f.pending[0].resolve('{}');
  await tick();
  assert.equal(f.ready.isReady(0), true);
  assert.equal(f.events.includes('invalid'), false);
});

test('style failure or reload during recovery prevents another replay from reviving that request', async () => {
  for (const fail of ['beginReload', 'acceptLoadFailure']) {
    const f = fixture();
    let cleanup = f.setup();
    f.ready.acceptReport(0, report);
    cleanup();
    cleanup = f.setup();
    assert.equal(f.ready[fail](0), true);
    cleanup();
    f.setup();
    f.pending[0].resolve(report);
    await tick();
    assert.equal(f.pending.length, 1);
    assert.equal(f.ready.isReady(0), false);
    assert.equal(f.events.includes('recover'), false);
    assert.equal(f.ready.acceptReport(0, report), null);
  }
});
