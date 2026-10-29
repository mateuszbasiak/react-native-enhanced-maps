import { test } from 'node:test';
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

test('Android cluster layout work coalesces and cancels across map lifetimes', () => {
  const output = path.resolve('artifacts/native-tests/coalesced-task');
  mkdirSync(output, { recursive: true });
  execFileSync('javac', [
    '-d',
    output,
    'packages/maps/android/src/main/java/com/enhancedmaps/CoalescedTask.java',
    'tests/native/CoalescedTaskTest.java',
  ]);
  execFileSync('java', ['-cp', output, 'CoalescedTaskTest']);
});
