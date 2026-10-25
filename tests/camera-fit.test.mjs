import { test } from 'node:test';
import assert from 'node:assert/strict';
test('fit requests validate and copy bounded coordinates and logical padding', async () => {
  const { fitRequest } = await import('../packages/maps/lib/cameraFit.js');
  const input = [
    { latitude: 1, longitude: 179 },
    { latitude: 2, longitude: -179 },
  ];
  const request = fitRequest(input, {
    padding: { top: 10, right: 20, bottom: 30, left: 40 },
    durationMs: 0,
  });
  input[0].latitude = 8;
  const largest = fitRequest(
    Array(1000).fill({
      latitude: -89.12345678901234,
      longitude: -179.12345678901235,
    }),
  );
  assert.ok(
    Buffer.byteLength(
      JSON.stringify({ ...largest, kind: 'fit', styleRevision: 1 }),
    ) <= 65536,
  );
  assert.equal(JSON.parse(request.coordinatesJSON)[0][0], 1);
  assert.deepEqual(
    [
      request.top,
      request.right,
      request.bottom,
      request.left,
      request.durationMs,
    ],
    [10, 20, 30, 40, 0],
  );
  assert.equal(fitRequest(undefined).coordinatesJSON, '');
  assert.equal(fitRequest(undefined).durationMs, 300);
  for (const coordinates of [
    [],
    Array(1001).fill({ latitude: 0, longitude: 0 }),
    [{ latitude: NaN, longitude: 0 }],
    [{ latitude: 0, longitude: 181 }],
  ])
    assert.throws(() => fitRequest(coordinates));
  for (const options of [
    { padding: -1 },
    { padding: { top: 0 } },
    { durationMs: Infinity },
    { durationMs: -1 },
    { durationMs: 60001 },
  ])
    assert.throws(() => fitRequest(undefined, options));
});
test('fit acknowledgement uses the existing correlated query lifecycle', async () => {
  const { createMapQueryClient, parseMapQueryResult } =
    await import('../packages/maps/lib/mapQueries.js');
  assert.equal(parseMapQueryResult('fit', '{"accepted":true}'), undefined);
  assert.throws(() => parseMapQueryResult('fit', '{"accepted":false}'));
  let requestId;
  const client = createMapQueryClient((id) => {
    requestId = id;
  });
  const pending = client.request('fit', { coordinatesJSON: '[]' }, 1);
  client.accept(requestId, '{"accepted":true}', '');
  assert.equal(await pending, undefined);
});

test('fit coordinates reject gaps rather than serializing missing points as null', async () => {
  const { fitRequest } = await import('../packages/maps/lib/cameraFit.js');
  for (const [length, missing] of [
    [1, 0],
    [3, 0],
    [3, 1],
    [3, 2],
    [1000, 500],
  ]) {
    const coordinates = Array.from({ length }, () => ({
      latitude: 1,
      longitude: 2,
    }));
    delete coordinates[missing];
    assert.throws(() => fitRequest(coordinates), {
      name: 'RangeError',
      message: 'Invalid fit coordinate',
    });
  }
  assert.throws(() => fitRequest(Array(1000)), /Invalid fit coordinate/);
});

test('fit coordinates validate every element and retain dense order without mutating inputs', async () => {
  const { fitRequest } = await import('../packages/maps/lib/cameraFit.js');
  for (const value of [
    undefined,
    null,
    {},
    [1, 2],
    { latitude: '1', longitude: 2 },
    { latitude: 1, longitude: Infinity },
  ]) {
    assert.throws(
      () => fitRequest([{ latitude: 0, longitude: 0 }, value]),
      /Invalid fit coordinate/,
    );
  }
  const coordinates = Object.freeze([
    Object.freeze({ latitude: -90, longitude: -180 }),
    Object.freeze({ latitude: 90, longitude: 180 }),
    Object.freeze({ latitude: 0, longitude: 0 }),
  ]);
  assert.deepEqual(JSON.parse(fitRequest(coordinates).coordinatesJSON), [
    [-90, -180],
    [90, 180],
    [0, 0],
  ]);
  assert.equal(fitRequest(undefined).coordinatesJSON, '');
});
