import { test } from 'node:test';
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
test('native callout overlays remain above extreme pin zIndexes and retain stable pin order', () => {
  const output = 'artifacts/native-tests';
  mkdirSync(output, { recursive: true });
  execFileSync('javac', [
    '-d',
    output,
    'packages/maps/android/src/main/java/com/enhancedmaps/MarkerOrder.java',
    'tests/native/MarkerOrderTest.java',
  ]);
  execFileSync('java', ['-cp', output, 'MarkerOrderTest']);
  execFileSync('c++', [
    '-std=c++17',
    '-Ipackages/maps/ios',
    'tests/native/MarkerOrderTest.cpp',
    '-o',
    output + '/marker-order',
  ]);
  execFileSync(output + '/marker-order');
});
