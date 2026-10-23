import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

test('native marker touch ownership stays reserved until the stream ends', () => {
  const output = path.resolve('artifacts/native-tests');
  mkdirSync(output, { recursive: true });
  execFileSync('javac', [
    '-d',
    output,
    'packages/maps/android/src/main/java/com/enhancedmaps/MarkerGestureGate.java',
    'tests/native/MarkerGestureGateTest.java',
  ]);
  assert.doesNotThrow(() =>
    execFileSync('java', ['-cp', output, 'MarkerGestureGateTest']),
  );
});
