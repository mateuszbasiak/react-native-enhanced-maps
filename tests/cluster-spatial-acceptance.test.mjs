import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  assertClusterPartition,
  assertClusterRun,
  assertObsoleteCluster,
} from '../scripts/cluster-spatial-expression.mjs';

const members = Array.from({ length: 12 }, (_, index) => ({
  id: `vessel-${index}`,
  coordinate: {
    latitude: (index % 3) * 0.00001,
    longitude: (index % 6 < 3 ? 179.8 : -179.8) + (index % 3) * 0.00001,
  },
  data: { name: `Vessel ${index}`, status: index % 2 ? 'moving' : 'moored' },
}));
const partition = () => [
  {
    count: 6,
    coordinate: { latitude: 0, longitude: 179.8 },
    members: members.filter((_, i) => i % 6 < 3),
  },
  {
    count: 6,
    coordinate: { latitude: 0, longitude: -179.8 },
    members: members.filter((_, i) => i % 6 >= 3),
  },
];
test('spatial acceptance validates an unordered complete native partition', () => {
  assert.doesNotThrow(() =>
    assertClusterPartition(partition().reverse(), 'antimeridian', false),
  );
});
test('spatial acceptance rejects missing, duplicate, miscounted or corrupted native members', () => {
  for (const corrupt of [
    (p) => {
      p.pop();
    },
    (p) => {
      p[1].members[0] = p[0].members[0];
    },
    (p) => {
      p[0].members[0].id = 'vessel-00';
    },
    (p) => {
      p[0].count++;
    },
    (p) => {
      p[0].members[0].coordinate.longitude = 0;
    },
    (p) => {
      p[0].members[0].data.name = 'wrong';
    },
    (p) => {
      p[0].coordinate.longitude = 500;
    },
    (p) => {
      p[0].coordinate.longitude = 50;
    },
    (p) => {
      p[0].clusterGroup = 'unexpected';
    },
  ]) {
    const p = structuredClone(partition());
    corrupt(p);
    assert.throws(() => assertClusterPartition(p, 'antimeridian', false));
  }
});
test('group audits reject members leaking across group boundaries', () => {
  const groups = ['moving', 'moored'].flatMap((clusterGroup) =>
    partition().map((p) => ({
      ...p,
      clusterGroup,
      count: p.members.filter((m) => m.data.status === clusterGroup).length,
      members: p.members.filter((m) => m.data.status === clusterGroup),
    })),
  );
  assert.doesNotThrow(() =>
    assertClusterPartition(groups, 'antimeridian', true),
  );
  groups[0].clusterGroup = 'moored';
  assert.throws(() => assertClusterPartition(groups, 'antimeridian', true));
});

test('runtime receipts cannot pass with empty or partial evidence', () => {
  for (const records of [
    [],
    Array(7).fill(null),
    [{ name: 'four spatial islands', partition: partition() }],
  ]) {
    assert.throws(() =>
      assertClusterRun({ platform: 'android', status: 'passed', records }),
    );
  }
});

test('complete runtime evidence passes and viewport/camera corruption fails', () => {
  const grouped = ['moving', 'moored'].flatMap((clusterGroup) =>
    partition().map((p) => {
      const selected = p.members.filter((m) => m.data.status === clusterGroup);
      return { ...p, clusterGroup, count: selected.length, members: selected };
    }),
  );
  const spatial = Array.from({ length: 4 }, (_, island) => ({
    count: 3,
    coordinate: {
      latitude: island % 2 ? 0.1 : -0.1,
      longitude: island >= 2 ? 0.2 : -0.2,
    },
    members: Array.from({ length: 3 }, (_, offset) => {
      const index = island * 3 + offset;
      return {
        ...members[index],
        coordinate: {
          latitude: (island % 2 ? 0.1 : -0.1) + offset * 0.00001,
          longitude: (island >= 2 ? 0.2 : -0.2) + offset * 0.00001,
        },
      };
    }),
  }));
  const names = [
    'four spatial islands',
    'east dateline',
    'west dateline',
    'wrapped world copies',
    'dateline group isolation',
    'style replacement',
    'remount',
  ];
  const longitudes = [0, 179.8, -179.8, 0, -179.8, -179.8, 179.8];
  const run = {
    status: 'passed',
    platform: 'ios',
    records: names.map((name, index) => ({
      name,
      ready: 1,
      observations: 3,
      viewport: { width: 1024, height: 300 },
      camera: {
        center: { latitude: 0, longitude: longitudes[index] },
        zoom: index === 0 ? 8 : index === 3 ? 0 : 5,
        heading: 0,
        pitch: 0,
      },
      ids: members.map((m) => m.id).sort(),
      partition: index === 0 ? spatial : index >= 4 ? grouped : partition(),
    })),
  };
  assert.doesNotThrow(() => assertClusterRun(run));
  const mixed = structuredClone(run);
  const all = mixed.records[0].partition.flatMap((c) => c.members);
  mixed.records[0].partition = [
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [9, 10, 11],
  ].map((indices) => {
    const selected = indices.map((i) => all[i]);
    return {
      count: 3,
      members: selected,
      coordinate: {
        latitude: selected.reduce((s, m) => s + m.coordinate.latitude, 0) / 3,
        longitude: selected.reduce((s, m) => s + m.coordinate.longitude, 0) / 3,
      },
    };
  });
  assert.throws(() => assertClusterRun(mixed), /island/i);
  for (const corrupt of [
    (r) => {
      r.records[0].camera.zoom = NaN;
    },
    (r) => {
      r.records[3].viewport.width = 512;
    },
    (r) => {
      r.records[3].camera.center.longitude = 179.8;
    },
    (r) => {
      r.records[0].camera.center.longitude = 90;
    },
    (r) => {
      r.records[0].ids = [];
    },
  ]) {
    const changed = structuredClone(run);
    corrupt(changed);
    assert.throws(() => assertClusterRun(changed));
  }
});

test('obsolete-handle evidence requires a real handle and the specific stale error', async () => {
  await assert.doesNotReject(() =>
    assertObsoleteCluster({
      getMembers: async () => {
        throw Error('Cluster is obsolete');
      },
    }),
  );
  for (const handle of [
    undefined,
    {},
    { getMembers: async () => [] },
    {
      getMembers: async () => {
        throw Error('native unavailable');
      },
    },
  ])
    await assert.rejects(() => assertObsoleteCluster(handle));
});
