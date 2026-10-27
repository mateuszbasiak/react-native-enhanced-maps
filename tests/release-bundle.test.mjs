import assert from 'node:assert/strict';
import test from 'node:test';
import { assertReleaseBundle } from '../scripts/release-bundle.mjs';

test('production bundle permits ordinary content and required shader runtime', () => {
  assert.doesNotThrow(() =>
    assertReleaseBundle('globalThis.__enhancedMapsShader.open(id);'),
  );
  assert.doesNotThrow(() => assertReleaseBundle('ordinary application code'));
});

test('production bundle rejects current and future Debug globals', () => {
  for (const name of [
    '__enhancedMapsVerification',
    '__enhancedMapsClusters',
    '__enhancedMapsLifecycle',
    '__enhancedMapsSettings',
    '__enhancedMapsShapes',
    '__enhancedMapsShapePicking',
    '__enhancedMapsFutureDebug',
    '__enhancedMapsShaderDebug',
  ]) {
    assert.throws(
      () => assertReleaseBundle(`globalThis.${name}={};`),
      /Development maps globals present/,
    );
  }
});

test('bundle exclusion failure never prints surrounding consumer content', () => {
  assert.throws(
    () =>
      assertReleaseBundle(
        'private consumer payload; globalThis.__enhancedMapsVerification={};',
      ),
    (error) => {
      assert.equal(
        error.message,
        'Development maps globals present in production bundle',
      );
      assert(!error.message.includes('private consumer payload'));
      return true;
    },
  );
});

test('production bundle rejects every configured secret without exposing content', () => {
  const secrets = ['first-private-key', 'second-private-key'];
  for (const secret of secrets) {
    assert.throws(
      () =>
        assertReleaseBundle(`private surrounding content ${secret}`, secrets),
      (error) => {
        assert.equal(
          error.message,
          'Configured maps secret present in production bundle',
        );
        assert(!String(error).includes(secret));
        assert(!String(error).includes('surrounding content'));
        return true;
      },
    );
  }
});

test('secret scanning uses literal values and ignores empty configuration', () => {
  assert.doesNotThrow(() =>
    assertReleaseBundle('ordinary application code', ['', 'absent-key']),
  );
  assert.doesNotThrow(() => assertReleaseBundle('aXb', ['a.b']));
  assert.throws(
    () => assertReleaseBundle('token=a.b', ['a.b']),
    /Configured maps secret present/,
  );
});
