import assert from 'node:assert/strict';
import { test } from 'node:test';
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
const output = path.resolve('artifacts/native-tests');
mkdirSync(output, { recursive: true });
test('Android native gate bounds delivery, suppresses absent subscribers, and flushes idle', () => {
  execFileSync('javac', [
    '-d',
    output,
    'packages/maps/android/src/main/java/com/enhancedmaps/CameraEventGate.java',
    'tests/native/CameraEventGateTest.java',
  ]);
  assert.doesNotThrow(() =>
    execFileSync('java', ['-cp', output, 'CameraEventGateTest']),
  );
});
test('iOS native gate obeys the same camera delivery contract', () => {
  const binary = path.join(output, 'camera-event-gate');
  execFileSync('c++', [
    '-std=c++17',
    '-Ipackages/maps/ios',
    'tests/native/CameraEventGateTest.cpp',
    '-o',
    binary,
  ]);
  assert.doesNotThrow(() => execFileSync(binary));
});
