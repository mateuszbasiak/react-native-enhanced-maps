import assert from 'node:assert/strict';
import { test } from 'node:test';
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

test('shared output never overwrites front, leased or in-flight native readers; close rejects publication', () => {
  const output = path.resolve('artifacts/native-tests');
  mkdirSync(output, { recursive: true });
  const binary = path.join(output, 'prototype-output-slots');
  execFileSync('c++', [
    '-std=c++17',
    '-Ipackages/maps/cpp',
    'tests/native/PrototypeOutputSlotsTest.cpp',
    '-o',
    binary,
  ]);
  assert.doesNotThrow(() => execFileSync(binary));
});
