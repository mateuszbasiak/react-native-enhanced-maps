import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';

async function load() {
  const url = new URL(
    '../packages/maps/lib/markerClustering.js',
    import.meta.url,
  );
  const code = readFileSync(url, 'utf8')
    .replace("from 'react'", `from '${import.meta.resolve('react')}'`)
    .replace(
      /from '(\.\/[^']+)'/g,
      (_, path) => `from '${new URL(path + '.js', url).href}'`,
    );
  return import(
    `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`
  );
}
const Marker = () => null;
const marker = (id, props = {}) =>
  React.createElement(Marker, {
    id,
    coordinate: { latitude: 54, longitude: 18 },
    children: 'boat',
    ...props,
  });

test('marker clustering is opt-in, preserves independent markers and keeps metadata off native transport', async () => {
  const { collectMarkers } = await load();
  const data = { name: 'Boat', callback() {} };
  const result = collectMarkers(
    React.createElement(
      React.Fragment,
      null,
      marker('a', { cluster: true, data }),
      marker('b'),
      marker('c', { cluster: false }),
    ),
    Marker,
  );
  assert.deepEqual([...result.markers.keys()], ['a']);
  assert.equal(result.markers.get('a').props.data, data);
  assert.equal(result.content.length, 2);
  assert.equal(result.data.features.length, 1);
  assert.deepEqual(result.data.features[0].properties, {});
  assert.deepEqual(result.data.features[0].geometry.coordinates, [18, 54]);
});

test('marker scene rejects duplicate IDs, invalid opt-in and invalid geographic coordinates', async () => {
  const { collectMarkers } = await load();
  assert.throws(
    () => collectMarkers([marker('a'), marker('a', { cluster: true })], Marker),
    /Duplicate/,
  );
  for (const props of [
    { cluster: 'yes' },
    { coordinate: { latitude: 91, longitude: 0 } },
    { id: 'em-cluster:1' },
  ])
    assert.throws(() => collectMarkers(marker('a', props), Marker));
  assert.throws(
    () =>
      collectMarkers(
        Array.from({ length: 10001 }, (_, i) =>
          marker(String(i), { cluster: true }),
        ),
        Marker,
      ),
    /limit/,
  );
});

test('native marker layouts validate bounds, cluster counts, duplicate IDs and source generation', async () => {
  const { parseMarkerLayout } = await load();
  const layout = {
    sourceRevision: 3,
    indexRevision: 8,
    features: [
      { id: 'a', latitude: 54, longitude: 18 },
      {
        id: 'em-cluster:14',
        latitude: 54,
        longitude: 18,
        clusterId: 14,
        count: 2,
      },
    ],
  };
  assert.deepEqual(parseMarkerLayout(JSON.stringify(layout), 3), layout);
  assert.equal(parseMarkerLayout(JSON.stringify(layout), 4), undefined);
  for (const features of [
    [layout.features[0], layout.features[0]],
    [{ ...layout.features[1], count: 1 }],
    [{ ...layout.features[1], id: 'wrong' }],
    [{ ...layout.features[0], latitude: 100 }],
  ])
    assert.equal(
      parseMarkerLayout(JSON.stringify({ ...layout, features }), 3),
      undefined,
    );
});

test('getMembers lazily pages through members, resolves original data and rejects stale or inconsistent results', async () => {
  const { resolveClusterMembers } = await load();
  const markers = new Map(
    Array.from({ length: 150 }, (_, i) => [
      String(i),
      marker(String(i), { data: { i } }),
    ]),
  );
  let calls = 0;
  const fetch = async (offset) => {
    calls++;
    return Array.from({ length: Math.min(100, 150 - offset) }, (_, i) =>
      String(offset + i),
    );
  };
  assert.equal(calls, 0);
  const members = await resolveClusterMembers(150, markers, fetch, () => true);
  assert.equal(calls, 2);
  assert.equal(members[149].data.i, 149);
  assert.ok(Object.isFrozen(members));
  await assert.rejects(
    resolveClusterMembers(150, markers, fetch, () => false),
    /obsolete/,
  );
  await assert.rejects(
    resolveClusterMembers(
      150,
      markers,
      async () => ['0'],
      () => true,
    ),
    /Incomplete/,
  );
  await assert.rejects(
    resolveClusterMembers(
      2,
      markers,
      async () => ['0', '0'],
      () => true,
    ),
    /Duplicate/,
  );
});

test('cluster groups partition colocated markers and preserve opt-out and default behavior', async () => {
  const { collectMarkers } = await load();
  const result = collectMarkers(
    [
      marker('boat-a', { cluster: true, clusterGroup: 'boats' }),
      marker('boat-b', { cluster: true, clusterGroup: 'boats' }),
      marker('marina', { cluster: true, clusterGroup: 'marinas' }),
      marker('default', { cluster: true }),
      marker('selected', { cluster: false, clusterGroup: 'boats' }),
    ],
    Marker,
  );
  assert.deepEqual(
    result.groups.map((g) => [
      g.clusterGroup,
      g.data.features.map((f) => f.id),
    ]),
    [
      [undefined, ['default']],
      ['boats', ['boat-a', 'boat-b']],
      ['marinas', ['marina']],
    ],
  );
  assert.equal(new Set(result.groups.map((g) => g.sourceId)).size, 3);
  assert.equal(result.content.length, 1);
  const changed = collectMarkers(
    [marker('a', { cluster: true, clusterGroup: 'one' })],
    Marker,
  );
  const moved = collectMarkers(
    [marker('a', { cluster: true, clusterGroup: 'two' })],
    Marker,
  );
  assert.notEqual(changed.signature, moved.signature);
  for (const clusterGroup of ['', ' ', 1, null, 'x'.repeat(513)])
    assert.throws(
      () =>
        collectMarkers(marker('a', { cluster: true, clusterGroup }), Marker),
      /clusterGroup/,
    );
});

test('layout IDs scope equal native cluster IDs to their group source', async () => {
  const { parseMarkerLayout } = await load();
  const features = [1, 2].map((group) => ({
    id: `em-cluster:${group}:14`,
    sourceId: `em-marker-clusters:${group}`,
    latitude: 54,
    longitude: 18,
    clusterId: 14,
    count: 2,
  }));
  const layout = { sourceRevision: 3, indexRevision: 8, features };
  assert.deepEqual(parseMarkerLayout(JSON.stringify(layout), 3), layout);
  for (const sourceId of [
    'public-source',
    'em-marker-clusters:0',
    'em-marker-clusters:01',
    'em-marker-clusters:65',
  ]) {
    assert.equal(
      parseMarkerLayout(
        JSON.stringify({ ...layout, features: [{ ...features[0], sourceId }] }),
        3,
      ),
      undefined,
    );
  }
});

test('group names remain exact, sources are deterministic, and group resources are bounded', async () => {
  const { collectMarkers } = await load();
  const markers = ['boats', 'Boats', ' boats', '__proto__'].map(
    (clusterGroup, i) => marker(String(i), { cluster: true, clusterGroup }),
  );
  const forward = collectMarkers(markers, Marker);
  const reverse = collectMarkers([...markers].reverse(), Marker);
  assert.equal(forward.groups.length, 4);
  assert.equal(forward.signature, reverse.signature);
  const groups = Array.from({ length: 64 }, (_, i) =>
    marker(String(i), { cluster: true, clusterGroup: String(i) }),
  );
  assert.equal(collectMarkers(groups, Marker).groups.length, 64);
  assert.throws(
    () =>
      collectMarkers([...groups, marker('default', { cluster: true })], Marker),
    /group limit/,
  );
});

test('clusterGroup enables clustering unless cluster explicitly overrides it', async () => {
  const { collectMarkers } = await load();
  const result = collectMarkers(
    [
      marker('independent'),
      marker('default', { cluster: true }),
      marker('implicit', { clusterGroup: 'boats' }),
      marker('explicit', { cluster: true, clusterGroup: 'boats' }),
      marker('disabled', { cluster: false, clusterGroup: 'boats' }),
      marker('disabled-default', { cluster: false }),
    ],
    Marker,
  );
  assert.deepEqual(
    [...result.markers.keys()],
    ['default', 'implicit', 'explicit'],
  );
  assert.deepEqual(
    result.content.map((node) => node.props.id),
    ['independent', 'disabled', 'disabled-default'],
  );
  assert.deepEqual(
    result.groups.map((group) => [
      group.clusterGroup,
      group.data.features.map((feature) => feature.id),
    ]),
    [
      [undefined, ['default']],
      ['boats', ['implicit', 'explicit']],
    ],
  );
  const implicit = collectMarkers(
    marker('a', { clusterGroup: 'boats' }),
    Marker,
  );
  const explicit = collectMarkers(
    marker('a', { cluster: true, clusterGroup: 'boats' }),
    Marker,
  );
  const disabled = collectMarkers(
    marker('a', { cluster: false, clusterGroup: 'boats' }),
    Marker,
  );
  assert.equal(implicit.signature, explicit.signature);
  assert.notEqual(implicit.signature, disabled.signature);
  assert.throws(
    () =>
      collectMarkers(
        marker('a', {
          clusterGroup: 'boats',
          coordinate: { latitude: 86, longitude: 0 },
        }),
        Marker,
      ),
    /latitude/,
  );
});
