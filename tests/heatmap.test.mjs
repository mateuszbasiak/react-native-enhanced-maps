import { test } from 'node:test';
import assert from 'node:assert/strict';
const heatmap = await import('../packages/maps/lib/heatmap.js').catch(
  () => ({}),
);
test('Heatmap produces bounded weighted geographic input and RN Maps defaults', () => {
  assert.equal(typeof heatmap.normalizeHeatmap, 'function');
  const h = heatmap.normalizeHeatmap({
    points: [
      { latitude: 1, longitude: 2 },
      { latitude: 3, longitude: 4, weight: 0 },
    ],
  });
  assert.equal(h.style.heatmapRadius, 20);
  assert.equal(h.style.heatmapOpacity, 0.7);
  assert.deepEqual(
    h.data.features.map((f) => f.properties.weight),
    [1, 0],
  );
  assert.deepEqual(h.data.features[0].geometry.coordinates, [2, 1]);
});
test('Heatmap samples the upstream gradient configuration and validates all entries', () => {
  const h = heatmap.normalizeHeatmap({
    points: [],
    gradient: {
      colors: ['#00000000', 'red'],
      startPoints: [0, 1],
      colorMapSize: 3,
    },
  });
  assert.deepEqual(h.style.heatmapGradient, [
    [0, '#00000000'],
    [0.5, '#80000080'],
    [1, '#ff0000ff'],
  ]);
  for (const bad of [
    { points: Array(1) },
    { points: [{ latitude: Infinity, longitude: 0 }] },
    { points: [{ latitude: 0, longitude: 0, weight: -1 }] },
    { points: [], radius: 0 },
    { points: [], opacity: NaN },
    { points: [], gradient: { colors: ['red'], startPoints: [2] } },
    { points: [], gradient: { colors: ['red', 'blue'], startPoints: [1, 0] } },
  ])
    assert.throws(() => heatmap.normalizeHeatmap(bad));
});

test('Heatmap accepts more than 50000 points and validates the final point', () => {
  const points = Array.from({ length: 50001 }, () => ({
    latitude: 1,
    longitude: 2,
  }));
  assert.equal(
    heatmap.normalizeHeatmap({ points }).data.features.length,
    50001,
  );
  points[50000] = { latitude: NaN, longitude: 2 };
  assert.throws(() => heatmap.normalizeHeatmap({ points }), /Invalid Heatmap/);
});
