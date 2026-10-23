import { test } from 'node:test';
import assert from 'node:assert/strict';
test('map presses validate native actions and finite tap geometry', async () => {
  const { parseNativeMapPress } =
    await import('../packages/maps/lib/mapPressEvents.js');
  const value = {
    action: 'tap',
    latitude: 54.37,
    longitude: 18.66,
    x: 12,
    y: 34,
  };
  assert.deepEqual(parseNativeMapPress(value), {
    action: 'tap',
    coordinate: { latitude: 54.37, longitude: 18.66 },
    position: { x: 12, y: 34 },
  });
  assert.equal(
    parseNativeMapPress({ ...value, action: 'long-press' }).action,
    'long-press',
  );
  for (const bad of [
    null,
    [],
    {},
    { ...value, action: 'double-tap' },
    { ...value, action: '' },
    { ...value, latitude: 91 },
    { ...value, longitude: -181 },
    { ...value, x: NaN },
    { ...value, y: Infinity },
    { ...value, latitude: '54' },
  ])
    assert.equal(parseNativeMapPress(bad), null);
  assert.deepEqual(
    parseNativeMapPress({ ...value, latitude: -90, longitude: 180, x: 0, y: 0 })
      .position,
    { x: 0, y: 0 },
  );
});
