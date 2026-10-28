import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

const root = path.resolve(import.meta.dirname, '..');
const script = path.join(root, 'scripts/prepare-native-consumer.mjs');
test('packed GPU consumer includes native peers, worklet plugin and isolated app IDs', () => {
  const parent = mkdtempSync(path.join(os.tmpdir(), 'maps-consumer-test-'));
  const output = path.join(parent, 'gpu');
  try {
    execFileSync(process.execPath, [script, '--shaders', output], {
      cwd: root,
    });
    const read = (file) => readFileSync(path.join(output, file), 'utf8');
    const manifest = JSON.parse(read('package.json'));
    assert.equal(manifest.dependencies['react-native-webgpu'], '0.17.0');
    assert.equal(manifest.dependencies['react-native-worklets'], '0.12.2');
    assert.match(read('android/build.gradle'), /minSdkVersion = 26/);
    assert.match(read('babel.config.js'), /react-native-worklets\/plugin/);
    assert.match(read('App.tsx'), /react-native-maplibre-maps\/shaders/);
    assert.match(
      read('android/app/build.gradle'),
      /applicationId "com.enhancedmaps.gpuconsumer"/,
    );
    assert.match(
      read('ios/EnhancedMapsExample.xcodeproj/project.pbxproj'),
      /PRODUCT_BUNDLE_IDENTIFIER = com.enhancedmaps.gpuconsumer;/,
    );
    const record = JSON.parse(read('verification.json'));
    assert.deepEqual(record.optionalPeers, [
      'react-native-webgpu',
      'react-native-worklets',
    ]);
    assert.equal(record.status, 'prepared');
    for (const file of [
      'ios/Config/Maps.local.xcconfig',
      'android/maps.local.properties',
    ])
      assert.equal(existsSync(path.join(output, file)), false);
    assert.equal(record.tarballSHA256.length, 64);
    assert.match(
      manifest.dependencies['react-native-maplibre-maps'],
      /^file:\.\//,
    );
    assert.notEqual(
      spawnSync(process.execPath, [script, '--shaders', output]).status,
      0,
    );
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});
test('native consumer rejects unknown options before creating output', () => {
  const result = spawnSync(process.execPath, [script, '--unknown'], {
    cwd: root,
    encoding: 'utf8',
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Unknown option/);
});

test('default packed consumer remains core-only', () => {
  const parent = mkdtempSync(path.join(os.tmpdir(), 'maps-core-test-'));
  const output = path.join(parent, 'core');
  try {
    execFileSync(process.execPath, [script, output], { cwd: root });
    const read = (file) => readFileSync(path.join(output, file), 'utf8');
    const manifest = JSON.parse(read('package.json'));
    assert.equal(manifest.dependencies['react-native-webgpu'], undefined);
    assert.equal(manifest.dependencies['react-native-worklets'], undefined);
    assert.match(read('android/build.gradle'), /minSdkVersion = 24/);
    assert.doesNotMatch(read('babel.config.js'), /worklets/);
    assert.doesNotMatch(read('App.tsx'), /\/shaders/);
    assert.deepEqual(JSON.parse(read('verification.json')).optionalPeers, []);
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});
