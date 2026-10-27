import { test } from 'node:test';
import assert from 'node:assert/strict';
const load = () => import('../packages/maps/lib/userLocation.js');

test('location values normalize a defensive snapshot and omit unknown native measurements', async () => {
  const { normalizeUserLocation } = await load();
  const value = {
    latitude: 54.37,
    longitude: 18.66,
    accuracy: 5,
    altitude: 12,
    heading: 359,
    speed: 2,
    timestamp: 100,
  };
  const result = normalizeUserLocation(value);
  assert.deepEqual(result, value);
  assert.notEqual(result, value);
  value.latitude = 0;
  assert.equal(result.latitude, 54.37);
  assert.deepEqual(normalizeUserLocation({ latitude: 1, longitude: 2 }), {
    latitude: 1,
    longitude: 2,
  });
});

test('location contracts reject invalid coordinates and optional measurements', async () => {
  const { normalizeUserLocation } = await load();
  for (const value of [
    null,
    [],
    {},
    { latitude: 91, longitude: 2 },
    { latitude: 1, longitude: 181 },
    { latitude: NaN, longitude: 2 },
    { latitude: 1, longitude: 2, accuracy: -1 },
    { latitude: 1, longitude: 2, speed: -1 },
    { latitude: 1, longitude: 2, heading: -1 },
    { latitude: 1, longitude: 2, heading: 360 },
    { latitude: 1, longitude: 2, timestamp: -1 },
    { latitude: 1, longitude: 2, altitude: Infinity },
  ])
    assert.throws(() => normalizeUserLocation(value));
});

test('native location events are revision scoped and malformed transport is ignored', async () => {
  const { parseUserLocationEvent } = await load();
  const value = {
    styleRevision: 3,
    locationJSON: '{"latitude":1,"longitude":2,"accuracy":4}',
  };
  assert.deepEqual(parseUserLocationEvent(value, 3), {
    nativeEvent: { coordinate: { latitude: 1, longitude: 2, accuracy: 4 } },
  });
  for (const bad of [
    null,
    {},
    { ...value, styleRevision: 2 },
    { ...value, error: 'location-permission' },
    { ...value, locationJSON: '{}' },
    { ...value, locationJSON: 'x' },
    { ...value, locationJSON: ' '.repeat(4097) },
  ])
    assert.equal(parseUserLocationEvent(bad, 3), null);
});
