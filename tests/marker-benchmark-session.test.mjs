import { test } from 'node:test';
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const output = 'artifacts/native-tests/marker-session';
test('native benchmark yields to manual gestures and invalidates delayed camera steps', () => {
  mkdirSync(output, { recursive: true });
  execFileSync('javac', [
    '-d',
    output,
    'packages/maps/android/src/main/java/com/enhancedmaps/MarkerBenchmarkSession.java',
    'tests/native/MarkerBenchmarkSessionTest.java',
  ]);
  execFileSync('java', ['-cp', output, 'MarkerBenchmarkSessionTest']);
});
