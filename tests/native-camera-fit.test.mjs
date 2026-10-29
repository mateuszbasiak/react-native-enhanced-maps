import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

// Exercise production fit parsing/bounds logic with Foundation and a minimal
// MapLibre view model. SDK rendering and simulator integration are separate checks.
test(
  'native iOS fit accepts more than 1000 coordinates and bounds input bytes before parsing',
  { skip: process.platform !== 'darwin' },
  () => {
    const output = mkdtempSync(path.join(tmpdir(), 'maps-fit-test-'));
    try {
      const binary = path.join(output, 'fit');
      execFileSync('clang++', [
        '-std=c++17',
        '-fobjc-arc',
        '-framework',
        'Foundation',
        '-Itests/native/fit-stubs',
        '-Ipackages/maps/ios',
        'tests/native/CameraFitTest.mm',
        '-o',
        binary,
      ]);
      execFileSync(binary);
    } finally {
      rmSync(output, { recursive: true, force: true });
    }
  },
);
