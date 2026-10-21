import assert from 'node:assert/strict';
import { test } from 'node:test';

const options = {
  root: '/workspace/maps',
  platform: 'darwin',
  node: '/tools/node',
};
test('example commands use Metro 8088, preserve simulator arguments', async () => {
  const { projectCommand } = await import('../scripts/project-commands.mjs');
  const steps = projectCommand(
    'ios',
    ['--simulator', 'iPhone 17 Pro'],
    options,
  );
  assert.equal(steps[0].cwd, '/workspace/maps/example');
  assert.deepEqual(steps[0].args.slice(-6), [
    'run-ios',
    '--port',
    '8088',
    '--no-packager',
    '--simulator',
    'iPhone 17 Pro',
  ]);
  assert.deepEqual(steps[0].env, {});
});
test('native build commands avoid launching apps and forward build arguments', async () => {
  const { projectCommand } = await import('../scripts/project-commands.mjs');
  const android = projectCommand(
    'build:android',
    ['-PreactNativeArchitectures=arm64-v8a'],
    options,
  ).at(-1);
  assert.equal(android.command, './gradlew');
  assert(android.args.includes(':app:assembleDebug'));
  assert(android.args.includes('-PreactNativeDevServerPort=8088'));
  assert.equal(android.args.at(-1), '-PreactNativeArchitectures=arm64-v8a');
  const ios = projectCommand('build:ios', [], options).at(-1);
  assert.equal(ios.command, 'xcodebuild');
  assert(ios.args.includes('CODE_SIGNING_ALLOWED=NO'));
  assert.throws(
    () => projectCommand('ios', [], { ...options, platform: 'linux' }),
    /macOS/,
  );
});
test('cleanup targets preserve credentials, dependencies and verification evidence', async () => {
  const { cleanTargets, projectCommand } =
    await import('../scripts/project-commands.mjs');
  assert(cleanTargets.includes('packages/maps/lib'));
  assert(cleanTargets.includes('artifacts/codegen'));
  assert(
    !cleanTargets.some((path) =>
      /env|Config|node_modules|verification|Pods/.test(path),
    ),
  );
  assert.throws(() => projectCommand('unknown', [], options), /Unknown/);
});
