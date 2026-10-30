import { test } from 'node:test';
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
test('Android image sampling respects queried texture dimensions and allocation retries', () => {
  const output = 'artifacts/native-tests/image-size';
  mkdirSync(output, { recursive: true });
  execFileSync('javac', [
    '-d',
    output,
    'packages/maps/android/src/main/java/com/enhancedmaps/ImageDecodeSize.java',
    'packages/maps/android/src/main/java/com/enhancedmaps/OverlayImagePath.java',
    'tests/native/ImageDecodeSizeTest.java',
  ]);
  execFileSync('java', ['-cp', output, 'ImageDecodeSizeTest']);
});
