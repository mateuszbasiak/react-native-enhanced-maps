import test from 'node:test';
import assert from 'node:assert/strict';
import { createMapReadiness } from '../packages/maps/lib/capabilities.js';
import { createMapQueryClient } from '../packages/maps/lib/mapQueries.js';
const report = JSON.stringify({
  engine: 'maplibre',
  platform: 'android',
  layers: {
    circle: 'unvalidated',
    symbol: 'unsupported',
    line: 'unvalidated',
    fill: 'unvalidated',
    raster: 'unsupported',
    heatmap: 'unsupported',
  },
  shaders: 'unvalidated',
  detailedGestures: 'unvalidated',
});
function fixture() {
  let sequence = 0;
  const timers = new Map(),
    sent = [];
  return {
    readiness: createMapReadiness('android'),
    timers,
    sent,
    queries: createMapQueryClient((id, request) => sent.push({ id, request }), {
      schedule: (callback) => {
        const id = ++sequence;
        timers.set(id, callback);
        return id;
      },
      cancel: (id) => timers.delete(id),
    }),
  };
}
test('100 failed-load/retry cycles release query timers and leave another map usable', async () => {
  const first = fixture(),
    second = fixture();
  second.readiness.activate(1);
  second.readiness.acceptReport(1, report);
  for (let revision = 1; revision <= 200; revision += 2) {
    first.readiness.activate(revision);
    assert.equal(first.readiness.acceptLoadFailure(revision), true);
    assert.equal(first.readiness.acceptReport(revision, report), null);
    assert.equal(first.readiness.beginReload(revision), true);
    first.readiness.activate(revision + 1);
    first.readiness.acceptReport(revision + 1, report);
    const pending = first.queries.request('bounds', {}, revision + 1);
    const rejected = assert.rejects(pending, /reload/);
    first.readiness.beginReload(revision + 1);
    first.queries.cancelAll('style reload');
    await rejected;
    assert.equal(first.timers.size, 0);
    first.queries.accept(
      first.sent.at(-1).id,
      '{"north":1,"south":0,"east":1,"west":0}',
      '',
    );
    const independent = second.queries.request('point', {}, 1);
    second.queries.accept(second.sent.at(-1).id, '{"x":1,"y":2}', '');
    assert.deepEqual(await independent, { x: 1, y: 2 });
    assert.equal(second.timers.size, 0);
    assert.equal(second.readiness.isReady(1), true);
  }
  first.readiness.deactivate();
  assert.equal(first.readiness.beginReload(200), false);
  assert.equal(first.readiness.acceptReport(200, report), null);
});
