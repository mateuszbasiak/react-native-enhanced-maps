import { test } from 'node:test';
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

test('native fit accepts scene world copies while explicit coordinates stay geographic', () => {
  const output = path.resolve('artifacts/native-tests');
  mkdirSync(output, { recursive: true });
  execFileSync('javac', [
    '-d',
    output,
    'packages/maps/android/src/main/java/com/enhancedmaps/FitLongitude.java',
    'tests/native/FitLongitudeTest.java',
  ]);
  execFileSync('java', ['-cp', output, 'FitLongitudeTest']);
  const binary = path.join(output, 'fit-longitude');
  execFileSync('c++', [
    '-std=c++17',
    '-Ipackages/maps/ios',
    'tests/native/FitLongitudeTest.cpp',
    '-o',
    binary,
  ]);
  execFileSync(binary);
});
