import { test } from 'node:test';
import assert from 'node:assert/strict';
test('native query broker correlates, validates and bounds pending work', async () => {
  const { createMapQueryClient } =
    await import('../packages/maps/lib/mapQueries.js');
  const sent = [],
    timers = new Map();
  let timerId = 0;
  const client = createMapQueryClient(
    (id, request) => sent.push({ id, request }),
    {
      schedule: (fn) => {
        timers.set(++timerId, fn);
        return timerId;
      },
      cancel: (id) => timers.delete(id),
    },
  );
  const a = client.request('point', {}, 2),
    b = client.request('coordinate', {}, 2);
  client.accept(sent[1].id, '{"latitude":54.37,"longitude":18.66}', '');
  client.accept(sent[0].id, '{"x":12,"y":34}', '');
  assert.deepEqual(await a, { x: 12, y: 34 });
  assert.deepEqual(await b, { latitude: 54.37, longitude: 18.66 });
  assert.equal(timers.size, 0);
  client.accept(sent[0].id, '{}', '');
  const bad = client.request('bounds', {}, 2);
  client.accept(
    sent.at(-1).id,
    '{"north":1,"south":2,"east":20,"west":10}',
    '',
  );
  await assert.rejects(bad, /Invalid native/);
  const pending = Array.from({ length: 32 }, () =>
    client.request('point', {}, 2),
  );
  const rejected = pending.map((p) => assert.rejects(p, /style changed/));
  await assert.rejects(client.request('point', {}, 2), /pending/);
  client.cancelAll('style changed');
  await Promise.all(rejected);
  assert.equal(timers.size, 0);
  const obsoleteId = sent.at(-1).id;
  const fresh = client.request('point', {}, 3);
  client.accept(obsoleteId, '{"x":999,"y":999}', '');
  client.accept(sent.at(-1).id, '{"x":1,"y":2}', '');
  assert.deepEqual(await fresh, { x: 1, y: 2 });
  const timeout = client.request('point', {}, 3);
  timers.values().next().value();
  await assert.rejects(timeout, /timed out/);
  const nativeError = client.request('point', {}, 3);
  client.accept(sent.at(-1).id, '', 'Map is not ready');
  await assert.rejects(nativeError, /not ready/);
  const broken = createMapQueryClient(() => {
    throw new Error('dispatch broke');
  });
  await assert.rejects(broken.request('point', {}, 0), /dispatch broke/);
});
test('geometry query arguments and results reject malformed data', async () => {
  const { validateMapPoint, validateMapCoordinate, parseMapQueryResult } =
    await import('../packages/maps/lib/mapQueries.js');
  assert.deepEqual(validateMapPoint({ x: -10, y: 20 }), { x: -10, y: 20 });
  for (const value of [null, {}, { x: NaN, y: 2 }, { x: 1, y: '2' }])
    assert.throws(() => validateMapPoint(value));
  for (const value of [
    null,
    {},
    { latitude: 91, longitude: 0 },
    { latitude: 0, longitude: 181 },
  ])
    assert.throws(() => validateMapCoordinate(value));
  assert.deepEqual(
    parseMapQueryResult(
      'bounds',
      '{"north":60,"south":50,"east":-170,"west":170}',
    ),
    { north: 60, south: 50, east: -170, west: 170 },
  );
  for (const [kind, json] of [
    ['point', '{"x":1e999,"y":0}'],
    ['coordinate', '{"latitude":91,"longitude":0}'],
    ['bounds', '{}'],
    ['point', '[]'],
    ['point', 'x'.repeat(2049)],
  ])
    assert.throws(() => parseMapQueryResult(kind, json), /Invalid native/);
});

test('private capability replies keep their own bound and remain raw for readiness schema validation', async () => {
  const { parseMapQueryResult } =
    await import('../packages/maps/lib/mapQueries.js');
  const raw = '{' + ' '.repeat(4094) + '}';
  assert.equal(parseMapQueryResult('capabilities', raw), raw);
  assert.throws(
    () => parseMapQueryResult('capabilities', raw + ' '),
    /Invalid native/,
  );
  assert.throws(
    () => parseMapQueryResult('capabilities', ''),
    /Invalid native/,
  );
  assert.throws(() => parseMapQueryResult('point', raw), /Invalid native/);
});

test('only a pending capability handshake can receive a reply before readiness', async () => {
  const { createMapQueryClient } =
    await import('../packages/maps/lib/mapQueries.js');
  const sent = [];
  const client = createMapQueryClient((id) => sent.push(id));
  const capability = client.request('capabilities', {}, 0);
  const camera = client.request('camera', {}, 0);
  const cancelled = assert.rejects(camera, /obsolete/);
  client.accept(sent[0], '{"engine":"maplibre"}', '', false);
  assert.equal(await capability, '{"engine":"maplibre"}');
  client.accept(sent[1], '{}', '', false);
  client.cancelAll('obsolete');
  await cancelled;
  client.accept(sent[0], '{}', '', false);
});

test('owned shader removal can finish during readiness recovery; attachment cannot', async () => {
  const { createMapQueryClient } =
    await import('../packages/maps/lib/mapQueries.js');
  const sent = [];
  const client = createMapQueryClient((id) => sent.push(id));
  const remove = client.request(
    'shaderLayer',
    { action: 'remove', id: 'a', poolId: 'old' },
    0,
  );
  const attach = client.request(
    'shaderLayer',
    { action: 'attach', id: 'a', poolId: 'new' },
    0,
  );
  const cancelled = assert.rejects(attach, /obsolete/);
  client.accept(sent[0], '{"accepted":true}', '', false);
  client.accept(sent[1], '{"accepted":true}', '', false);
  assert.equal(await remove, undefined);
  client.cancelAll('obsolete');
  await cancelled;
});
