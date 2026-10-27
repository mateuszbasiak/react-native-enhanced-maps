import assert from 'node:assert/strict';
import { test } from 'node:test';
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const output = path.resolve('artifacts/native-tests');
mkdirSync(output, { recursive: true });
test('Android map lifecycle requires an attached active host and disposal is terminal', () => {
  execFileSync('javac', [
    '-d',
    output,
    'packages/maps/android/src/main/java/com/enhancedmaps/MapLifecycleGate.java',
    'tests/native/MapLifecycleGateTest.java',
  ]);
  assert.doesNotThrow(() =>
    execFileSync('java', ['-cp', output, 'MapLifecycleGateTest']),
  );
});
