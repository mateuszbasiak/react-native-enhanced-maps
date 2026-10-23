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
