import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizeMapSettings } from '../packages/maps/lib/mapSettings.js';

test('map settings normalize portable defaults and preserve explicit false and equal zoom limits', () => {
  assert.deepEqual(normalizeMapSettings({}), {
    scrollEnabled: true,
    zoomEnabled: true,
    rotateEnabled: true,
    pitchEnabled: true,
    showsCompass: true,
    minZoomLevel: 0,
    maxZoomLevel: 24,
  });
  const settings = normalizeMapSettings({
    scrollEnabled: false,
    zoomEnabled: false,
    rotateEnabled: false,
    pitchEnabled: false,
    showsCompass: false,
    minZoomLevel: 12,
    maxZoomLevel: 12,
  });
  assert.ok(Object.isFrozen(settings));
  assert.equal(settings.scrollEnabled, false);
  assert.equal(settings.zoomEnabled, false);
  assert.equal(settings.rotateEnabled, false);
  assert.equal(settings.pitchEnabled, false);
  assert.equal(settings.showsCompass, false);
  assert.equal(settings.minZoomLevel, 12);
  assert.equal(settings.maxZoomLevel, 12);
});

test('invalid map settings reject before reaching native state', () => {
  for (const name of [
    'scrollEnabled',
    'zoomEnabled',
    'rotateEnabled',
    'pitchEnabled',
    'showsCompass',
  ])
    for (const value of [null, 0, 1, 'false'])
      assert.throws(() => normalizeMapSettings({ [name]: value }), TypeError);
  for (const name of ['minZoomLevel', 'maxZoomLevel'])
    for (const value of [null, '12', NaN, Infinity, -1, 25])
      assert.throws(() => normalizeMapSettings({ [name]: value }), RangeError);
  assert.throws(
    () => normalizeMapSettings({ minZoomLevel: 20, maxZoomLevel: 10 }),
    RangeError,
  );
});
