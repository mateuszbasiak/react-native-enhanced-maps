import assert from 'node:assert/strict';
import { test } from 'node:test';
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
test('native atlas state pins metadata with the front slot, projects coverage and closes outstanding handles', () => {
  mkdirSync('artifacts/native-tests', { recursive: true });
  const binary = 'artifacts/native-tests/shader-output-state';
  execFileSync('c++', [
    '-std=c++17',
    '-Ipackages/maps/cpp',
    'tests/native/ShaderOutputStateTest.cpp',
    '-o',
    binary,
  ]);
  assert.doesNotThrow(() => execFileSync(binary));
});
