import { test } from 'node:test';
import assert from 'node:assert/strict';
test('location following pauses for gestures and respects controlled camera ownership', async () => {
  const { createLocationFollowState } =
    await import('../packages/maps/lib/locationTracking.js');
  const follow = createLocationFollowState();
  const fix = { latitude: 54, longitude: 18 };
  assert.equal(follow.update(fix), undefined);
  follow.configure(true, false);
  assert.deepEqual(follow.update(fix), fix);
  follow.gesture();
  follow.configure(true, false);
  assert.equal(follow.update(fix), undefined);
  assert.deepEqual(follow.resume(), fix);
  follow.configure(true, true);
  assert.equal(follow.update(fix), undefined);
  follow.configure(true, false);
  assert.deepEqual(follow.update(fix), fix);
  follow.configure(false, false);
  assert.equal(follow.resume(), undefined);
  follow.configure(true, false);
  assert.deepEqual(follow.update(fix), fix);
});
test('clearing a fix invalidates pending follow targets and prevents stale resume', async () => {
  const { createLocationFollowState } =
    await import('../packages/maps/lib/locationTracking.js');
  const follow = createLocationFollowState();
  follow.configure(true, false);
  const target = follow.update({ latitude: 54, longitude: 18 });
  assert.equal(follow.current(), target);
  follow.clear();
  assert.equal(follow.current(), undefined);
  assert.equal(follow.resume(), undefined);
});
