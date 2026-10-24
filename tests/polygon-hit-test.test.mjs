import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
const output = path.resolve('artifacts/native-tests');
mkdirSync(output, { recursive: true });
test('Android polygon hit geometry subtracts holes and preserves world copies', () => {
  execFileSync(
    'javac',
    [
      '-d',
      output,
      'packages/maps/android/src/main/java/com/enhancedmaps/PolygonHitTest.java',
      'tests/native/PolygonHitTest.java',
    ],
    { stdio: 'pipe' },
  );
  assert.doesNotThrow(() =>
    execFileSync('java', ['-cp', output, 'PolygonHitTest']),
  );
});
test('iOS polygon hit geometry obeys the same fill and hole contract', () => {
  const binary = path.join(output, 'polygon-hit-test');
  execFileSync(
    'c++',
    [
      '-std=c++17',
      '-Ipackages/maps/ios',
      'tests/native/PolygonHitTest.cpp',
      '-o',
      binary,
    ],
    { stdio: 'pipe' },
  );
  assert.doesNotThrow(() => execFileSync(binary));
});
