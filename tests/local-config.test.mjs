import assert from 'node:assert/strict';
import { test } from 'node:test';

test('local map keys support quoted dotenv values and environment overrides', async () => {
  const { readLocalMapsConfig } = await import('../scripts/local-config.mjs');
  assert.deepEqual(readLocalMapsConfig('GOOGLE_MAPS_IOS_API_KEY="ios_test"\nGOOGLE_MAPS_ANDROID_API_KEY=android_test\nPATH=untrusted\n', { GOOGLE_MAPS_ANDROID_API_KEY: 'override_test' }), {
    GOOGLE_MAPS_IOS_API_KEY: 'ios_test', GOOGLE_MAPS_ANDROID_API_KEY: 'override_test',
  });
});

test('malformed keys cannot inject native configuration or leak through errors', async () => {
  const { readLocalMapsConfig } = await import('../scripts/local-config.mjs');
  assert.throws(() => readLocalMapsConfig('GOOGLE_MAPS_IOS_API_KEY="secret with spaces"'), error => {
    assert(!error.message.includes('secret with spaces'));
    return /GOOGLE_MAPS_IOS_API_KEY/.test(error.message);
  });
  assert.deepEqual(readLocalMapsConfig(''), { GOOGLE_MAPS_IOS_API_KEY: '', GOOGLE_MAPS_ANDROID_API_KEY: '' });
});

test('build redaction includes old generated keys after local credentials change', async () => {
  const { collectLocalMapsSecrets, redactLocalText } = await import('../scripts/local-config.mjs');
  assert.equal(typeof collectLocalMapsSecrets, 'function');
  const { mkdtempSync, mkdirSync, writeFileSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const path = await import('node:path');
  const root = mkdtempSync(path.join(tmpdir(), 'enhanced-maps-keys-'));
  try {
    mkdirSync(path.join(root, 'example/ios/Config'), { recursive: true });
    mkdirSync(path.join(root, 'example/android'), { recursive: true });
    writeFileSync(path.join(root, '.env.local'), 'GOOGLE_MAPS_IOS_API_KEY=new_ios');
    writeFileSync(path.join(root, 'example/ios/Config/Maps.local.xcconfig'), 'GOOGLE_MAPS_IOS_API_KEY = old_ios');
    writeFileSync(path.join(root, 'example/android/maps.local.properties'), 'GOOGLE_MAPS_ANDROID_API_KEY=old_android');
    const secrets = collectLocalMapsSecrets(root, { GOOGLE_MAPS_IOS_API_KEY: 'env_ios' });
    const output = redactLocalText('new_ios old_ios old_android env_ios', secrets);
    assert.equal(output, '[REDACTED] [REDACTED] [REDACTED] [REDACTED]');
  } finally { rmSync(root, { recursive: true, force: true }); }
});
