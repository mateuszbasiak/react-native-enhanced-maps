import { test } from 'node:test';
import assert from 'node:assert/strict';
const overlay = await import('../packages/maps/lib/imageOverlay.js').catch(
  () => ({}),
);
test('Overlay accepts RN Maps NE/SW tuples and emits NW/NE/SE/SW corners', () => {
  assert.equal(typeof overlay.normalizeOverlay, 'function');
  const p = overlay.normalizeOverlay({
    image: { uri: 'https://example.com/image.png' },
    bounds: [
      [2, 3],
      [0, 1],
    ],
  });
  assert.deepEqual(p.coordinates, [
    [1, 2],
    [3, 2],
    [3, 0],
    [1, 0],
  ]);
  assert.equal(p.opacity, 1);
  assert.equal(p.tappable, false);
});
test('Overlay resolves required assets and rotates clockwise in Mercator coordinates', () => {
  const props = {
    image: 7,
    bounds: [
      [1, 1],
      [-1, -1],
    ],
    bearing: 450,
  };
  const p = overlay.normalizeOverlay(props, () => ({ uri: 'pin_map' }));
  assert.equal(p.uri, 'pin_map');
  assert.ok(p.coordinates[0][0] > 0 && p.coordinates[0][1] > 0);
  assert.equal(p.bearing, 90);
  for (const invalid of [
    {
      bounds: [
        [0, 0],
        [1, 1],
      ],
    },
    { opacity: 2 },
    { bearing: NaN },
    { image: { uri: 'data:image/png;base64,large' } },
    {
      bounds: [
        [90, 1],
        [0, 0],
      ],
    },
  ])
    assert.throws(() =>
      overlay.normalizeOverlay({ ...props, ...invalid }, () => ({
        uri: 'pin_map',
      })),
    );
});
