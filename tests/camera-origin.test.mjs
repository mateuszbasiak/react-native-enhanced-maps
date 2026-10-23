import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
test('JS preserves native origins and treats unfamiliar reasons as unknown', async () => {
  const { normalizeCameraOrigin } =
    await import('../packages/maps/lib/cameraOrigin.js');
  for (const origin of ['gesture', 'application', 'sdk', 'unknown'])
    assert.equal(normalizeCameraOrigin(origin), origin);
  for (const origin of [undefined, null, '', 'pan', 1, true])
    assert.equal(normalizeCameraOrigin(origin), 'unknown');
});
test('native camera provenance follows SDK reasons without retaining an idle origin', () => {
  const output = path.resolve('artifacts/native-tests');
  mkdirSync(output, { recursive: true });
  execFileSync('javac', [
    '-d',
    output,
    'packages/maps/android/src/main/java/com/enhancedmaps/CameraOriginTracker.java',
    'tests/native/CameraOriginTest.java',
  ]);
  assert.doesNotThrow(() =>
    execFileSync('java', ['-cp', output, 'CameraOriginTest']),
  );
  const binary = path.join(output, 'camera-origin');
  execFileSync('c++', [
    '-std=c++17',
    '-Ipackages/maps/ios',
    'tests/native/CameraOriginTest.cpp',
    '-o',
    binary,
  ]);
  assert.doesNotThrow(() => execFileSync(binary));
});
