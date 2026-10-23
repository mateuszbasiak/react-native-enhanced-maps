import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
const output = path.resolve('artifacts/codegen');
mkdirSync(output, { recursive: true });
const result = spawnSync(
  process.execPath,
  [
    'node_modules/react-native/scripts/generate-codegen-artifacts.js',
    '-p',
    'packages/maps',
    '-t',
    'all',
    '-o',
    output,
    '-s',
    'library',
  ],
  { stdio: 'inherit' },
);
process.exit(result.status ?? 1);
