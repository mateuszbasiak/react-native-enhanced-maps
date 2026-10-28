import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
const output = path.resolve('artifacts/native-tests');
mkdirSync(output, { recursive: true });
test('native snapshot generations reject interrupted completions without coupling maps', () => {
  execFileSync('javac', [
    '-d',
    output,
    'packages/maps/android/src/main/java/com/enhancedmaps/SnapshotGeneration.java',
    'tests/native/SnapshotGenerationTest.java',
  ]);
  assert.doesNotThrow(() =>
    execFileSync('java', ['-cp', output, 'SnapshotGenerationTest']),
  );
  const binary = path.join(output, 'snapshot-generation');
  execFileSync('clang++', [
    '-std=c++17',
    '-Ipackages/maps/ios',
    'tests/native/SnapshotGenerationTest.cpp',
    '-o',
    binary,
  ]);
  assert.doesNotThrow(() => execFileSync(binary));
});
