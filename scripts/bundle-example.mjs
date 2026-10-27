import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { assertReleaseBundle } from './release-bundle.mjs';
import { collectLocalMapsSecrets } from './local-config.mjs';
const root = process.cwd();
const secrets = collectLocalMapsSecrets(root, process.env);
for (const platform of ['ios', 'android']) {
  const output = path.join(root, 'artifacts/bundles', platform);
  mkdirSync(output, { recursive: true });
  const result = spawnSync(
    process.execPath,
    [
      path.join(root, 'node_modules/react-native/cli.js'),
      'bundle',
      '--platform',
      platform,
      '--entry-file',
      'index.js',
      '--dev',
      'false',
      '--max-workers',
      '2',
      '--bundle-output',
      path.join(output, 'main.jsbundle'),
      '--assets-dest',
      output,
    ],
    { cwd: 'example', stdio: 'inherit' },
  );
  if (result.status !== 0) process.exit(result.status ?? 1);
  assertReleaseBundle(
    readFileSync(path.join(output, 'main.jsbundle'), 'utf8'),
    secrets,
  );
  console.log(
    `${platform}: development maps globals and configured maps secrets absent from production bundle`,
  );
}
