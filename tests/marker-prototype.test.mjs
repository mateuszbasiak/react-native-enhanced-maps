import { test } from 'node:test';
import assert from 'node:assert/strict';
import { markerCoordinates } from '../packages/maps/lib/markerPrototype.js';
test('marker workload is deterministic, bounded and prefix stable', () => {
  const small = markerCoordinates(100);
  assert.deepEqual(small, markerCoordinates(500).slice(0, 100));
  assert.equal(small.length, 100);
  assert.ok(
    small.every(
      (p) =>
        Math.abs(p.latitude - 52.2297) < 0.04 &&
        Math.abs(p.longitude - 21.0122) < 0.06,
    ),
  );
});
test('invalid workloads are rejected', () => {
  for (const count of [-1, 1.5, 5001, NaN])
    assert.throws(() => markerCoordinates(count));
});
