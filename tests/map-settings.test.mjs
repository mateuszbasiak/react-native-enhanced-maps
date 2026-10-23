import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizeMapSettings } from '../packages/maps/lib/mapSettings.js';

test('map settings normalize portable defaults and preserve explicit false and equal zoom limits', () => {
  assert.deepEqual(normalizeMapSettings({}), {
    mapPaddingTop: 0,
    mapPaddingRight: 0,
    mapPaddingBottom: 0,
    mapPaddingLeft: 0,
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

test('persistent map padding normalizes and copies logical-point edges', () => {
  const input = { top: 0.5, right: 20, bottom: 30, left: 40 };
  const normalized = normalizeMapSettings({ mapPadding: input });
  assert.equal(normalized.mapPaddingTop, 0.5);
  assert.equal(normalized.mapPaddingRight, 20);
  assert.equal(normalized.mapPaddingBottom, 30);
  assert.equal(normalized.mapPaddingLeft, 40);
  input.top = 999;
  assert.equal(normalized.mapPaddingTop, 0.5);
  const uniform = normalizeMapSettings({ mapPadding: 12 });
  for (const edge of ['Top', 'Right', 'Bottom', 'Left'])
    assert.equal(uniform[`mapPadding${edge}`], 12);
  assert.equal(normalizeMapSettings({}).mapPaddingTop, 0);
});

test('persistent padding rejects malformed, negative and unbounded edges', () => {
  for (const mapPadding of [
    null,
    -1,
    NaN,
    Infinity,
    100001,
    {},
    { top: 0, right: 0, bottom: 0 },
    { top: 0, right: 0, bottom: 0, left: -1 },
    { top: 0, right: 0, bottom: 0, left: '12' },
  ])
    assert.throws(() => normalizeMapSettings({ mapPadding }), RangeError);
});
