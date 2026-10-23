import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  selectShaderTiles,
  tileWorldRect,
} from '../packages/maps/lib/shaderTiles.js';
test('world output covers the visible area within a fixed atlas budget', () => {
  for (const view of [
    [0, 0, 1, 1, 0],
    [0.49, 0.49, 0.51, 0.51, 12],
    [-0.1, 0.2, 0.1, 0.8, 4],
    [0.95, 0.4, 1.05, 0.6, 5],
  ]) {
    const tiles = selectShaderTiles(view);
    assert.ok(tiles.length > 0 && tiles.length <= 16);
    const z = tiles[0].z;
    assert.ok(tiles.every((t) => t.z === z && t.y >= 0 && t.y < 2 ** z));
    for (const x of [view[0], view[2] - 1e-9])
      for (const y of [Math.max(0, view[1]), Math.min(1, view[3]) - 1e-9])
        assert.ok(
          tiles.some(
            (t) =>
              x >= t.x / 2 ** z &&
              x < (t.x + 1) / 2 ** z &&
              y >= t.y / 2 ** z &&
              y < (t.y + 1) / 2 ** z,
          ),
        );
  }
});
test('tile coordinates preserve unwrapped longitude and exact shared boundaries', () => {
  const a = tileWorldRect({ x: 3, y: 2, z: 3 }),
    b = tileWorldRect({ x: 4, y: 2, z: 3 });
  assert.equal(a[0] + a[2], b[0]);
  assert.ok(
    selectShaderTiles([0.95, 0.4, 1.05, 0.6, 4]).some((t) => t.x >= 2 ** t.z),
  );
  assert.throws(() => selectShaderTiles([NaN, 0, 1, 1, 0]));
});
