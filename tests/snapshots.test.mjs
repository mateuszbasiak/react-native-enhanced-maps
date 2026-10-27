import { test } from 'node:test';
import assert from 'node:assert/strict';
const load = () => import('../packages/maps/lib/snapshots.js');
test('snapshot requests normalize bounded mounted viewport options', async () => {
  const { snapshotRequest } = await load();
  assert.deepEqual(snapshotRequest(), {
    width: 0,
    height: 0,
    format: 'png',
    quality: 1,
    result: 'file',
  });
  assert.deepEqual(
    snapshotRequest({
      width: 800,
      height: 600,
      format: 'jpg',
      quality: 0.7,
      result: 'base64',
    }),
    { width: 800, height: 600, format: 'jpg', quality: 0.7, result: 'base64' },
  );
  for (const options of [
    { width: 0 },
    { height: 4097 },
    { width: NaN },
    { width: 1.5 },
    { quality: -1 },
    { quality: 2 },
    { quality: NaN },
    { format: 'webp' },
    { result: 'uri' },
    { region: {} },
    { width: 4096, height: 4096 },
  ])
    assert.throws(() => snapshotRequest(options));
});
test('snapshot results validate bounded file and base64 transports', async () => {
  const { parseSnapshotResult } = await load();
  assert.equal(
    parseSnapshotResult(
      JSON.stringify({ value: 'file:///tmp/enhanced-map-123.png', file: true }),
    ),
    'file:///tmp/enhanced-map-123.png',
  );
  assert.equal(
    parseSnapshotResult(JSON.stringify({ value: 'iVBORw0KGgo=', file: false })),
    'iVBORw0KGgo=',
  );
  for (const value of [
    { value: 'https://example.com/a.png', file: true },
    { value: 'bad base64!', file: false },
    { value: '', file: false },
    { value: 42, file: false },
    { value: 'file:///tmp/a.png', file: 'yes' },
  ])
    assert.throws(() => parseSnapshotResult(JSON.stringify(value)));
});

test('snapshot queries bypass the ordinary geometry response cap and obey cancellation', async () => {
  const { parseMapQueryResult, createMapQueryClient } =
    await import('../packages/maps/lib/mapQueries.js');
  const value = 'AQID'.repeat(1024);
  assert.equal(
    parseMapQueryResult('snapshot', JSON.stringify({ value, file: false })),
    value,
  );
  let id;
  const client = createMapQueryClient((requestId) => {
    id = requestId;
  });
  const pending = client.request(
    'snapshot',
    { width: 0, height: 0, quality: 1, format: 'png', result: 'file' },
    1,
  );
  client.cancelAll('Map query invalidated by style change or unmount');
  await assert.rejects(pending, /invalidated/);
  assert.doesNotThrow(() =>
    client.accept(
      id,
      JSON.stringify({ value: 'file:///tmp/map.png', file: true }),
      '',
    ),
  );
});

test(
  'iOS snapshot resources preserve SDK URL-template placeholders',
  { skip: process.platform !== 'darwin' },
  async () => {
    const { execFileSync } = await import('node:child_process');
    const { mkdirSync } = await import('node:fs');
    mkdirSync('artifacts/native-tests', { recursive: true });
    execFileSync('clang', [
      '-fobjc-arc',
      '-framework',
      'Foundation',
      '-Ipackages/maps/ios',
      'tests/native/SnapshotResourcesTest.m',
      '-o',
      'artifacts/native-tests/snapshot-resources',
    ]);
    execFileSync('artifacts/native-tests/snapshot-resources');
  },
);
