import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createMapQueryClient } from '../packages/maps/lib/mapQueries.js';
const load = () => {
  const url = new URL(
    '../packages/maps/lib/clusterQueries.js',
    import.meta.url,
  );
  const code = readFileSync(url, 'utf8').replace(
    /from '(\.\/[^']+)'/g,
    (_, path) => `from '${new URL(path + '.js', url).href}'`,
  );
  return import(
    `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`
  );
};

test('cluster handles reject copies, foreign maps and stale styles; paging is bounded', async () => {
  const { createClusterHandles } = await load();
  const owner = createClusterHandles(),
    other = createClusterHandles();
  const properties = { cluster: true, cluster_id: 14, point_count: 3 };
  const handle = owner.capture('places', 'cluster:14', properties, 2, 0);
  assert.ok(Object.isFrozen(handle));
  assert.deepEqual(owner.request(handle, 0), {
    sourceId: 'places',
    clusterId: 14,
    indexRevision: 2,
    pointCount: 3,
    limit: 100,
    offset: 0,
  });
  assert.throws(() => other.request(handle, 0));
  assert.throws(() => owner.request({ ...handle }, 0));
  assert.throws(() => owner.request(handle, 1));
  for (const page of [
    1,
    [],
    { extra: true },
    { limit: 0 },
    { limit: 101 },
    { limit: 1.5 },
    { offset: -1 },
    { offset: Number.MAX_SAFE_INTEGER + 1 },
    { offset: NaN },
  ])
    assert.throws(() => owner.request(handle, 0, page));
  assert.equal(owner.capture('places', 'point', {}, 2, 0), undefined);
});

test('cluster broker accepts validated pages beyond geometry limits and rejects malformed pages', async () => {
  const { parseClusterQueryResult } = await load();
  const sent = [];
  const client = createMapQueryClient(
    (id, request) => sent.push({ id, request }),
    { parseClusterResult: parseClusterQueryResult },
  );
  const request = client.request('clusterLeaves', {}, 0);
  const page = {
    sourceId: 'places',
    indexRevision: 1,
    total: 1,
    offset: 0,
    features: [
      {
        featureId: 'a',
        latitude: 1,
        longitude: 1,
        properties: { large: 'x'.repeat(3000) },
      },
    ],
  };
  client.accept(sent.at(-1).id, JSON.stringify(page), '');
  assert.equal((await request).features[0].properties.large.length, 3000);
  const invalid = client.request('clusterLeaves', {}, 0);
  client.accept(sent.at(-1).id, JSON.stringify({ ...page, total: 0 }), '');
  await assert.rejects(invalid, /Invalid native map query result/);
  assert.throws(() =>
    parseClusterQueryResult(
      'clusterLeaves',
      JSON.stringify({
        ...page,
        features: [
          { ...page.features[0], properties: { large: '地'.repeat(100000) } },
        ],
      }),
    ),
  );
});

test('cluster pages validate and freeze data, and child clusters retain index ownership', async () => {
  const { parseClusterQueryResult, createClusterHandles } = await load();
  const page = {
    sourceId: 'places',
    indexRevision: 2,
    total: 3,
    offset: 0,
    features: [
      {
        featureId: 'a',
        latitude: 54,
        longitude: 18,
        properties: { nested: [null, true] },
      },
      {
        featureId: 'cluster:9',
        latitude: 54,
        longitude: 18,
        properties: { cluster: true, cluster_id: 9, point_count: 2 },
      },
    ],
  };
  const owner = createClusterHandles();
  const result = owner.page(
    parseClusterQueryResult('clusterChildren', JSON.stringify(page)),
    0,
  );
  assert.ok(Object.isFrozen(result.features[0].properties.nested));
  assert.equal(result.features[1].cluster.pointCount, 2);
  assert.equal(owner.request(result.features[1].cluster, 0).indexRevision, 2);
  assert.equal(parseClusterQueryResult('clusterExpansion', '{"zoom":15}'), 15);
  for (const invalid of [
    { ...page, indexRevision: 0 },
    { ...page, total: Number.MAX_SAFE_INTEGER + 1 },
    { ...page, features: Array(101).fill(page.features[0]) },
    { ...page, features: [{ ...page.features[0], latitude: NaN }] },
  ])
    assert.throws(() =>
      parseClusterQueryResult('clusterLeaves', JSON.stringify(invalid)),
    );
  assert.throws(() =>
    parseClusterQueryResult('clusterExpansion', '{"zoom":-1}'),
  );
  assert.throws(() =>
    parseClusterQueryResult(
      'clusterLeaves',
      JSON.stringify({
        ...page,
        features: [
          { ...page.features[0], properties: { large: 'x'.repeat(262144) } },
        ],
      }),
    ),
  );
});

test('cluster counts and page offsets accept values beyond 10k', async () => {
  const { createClusterHandles, parseClusterQueryResult } = await load();
  const owner = createClusterHandles();
  const handle = owner.capture(
    'places',
    'cluster:14',
    { cluster: true, cluster_id: 14, point_count: 20001 },
    1,
    0,
  );
  assert.ok(handle);
  assert.equal(owner.request(handle, 0, { offset: 20000 }).offset, 20000);
  const page = {
    sourceId: 'places',
    indexRevision: 1,
    total: 20001,
    offset: 20000,
    features: [
      { featureId: 'last', latitude: 1, longitude: 1, properties: {} },
    ],
  };
  assert.equal(
    parseClusterQueryResult('clusterLeaves', JSON.stringify(page)).total,
    20001,
  );
  assert.equal(
    owner.request(handle, 0, { offset: Number.MAX_SAFE_INTEGER }).offset,
    Number.MAX_SAFE_INTEGER,
  );
});
