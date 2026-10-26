import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertReleaseBundle } from './release-bundle.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
assert(
  args.length === 0 || (args.length === 1 && args[0] === '--offline'),
  'Usage: npm run verify:optional-peers -- [--offline]',
);
const output = mkdtempSync(path.join(os.tmpdir(), 'maps-optional-peers-'));
console.log(`Consumer matrix: ${output}`);
const json = (file) => JSON.parse(readFileSync(file, 'utf8'));
const save = (file, value) =>
  writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
const locked = json(path.join(root, 'package-lock.json'));
const example = json(path.join(root, 'example/package.json'));
const manifest = json(path.join(root, 'packages/maps/package.json'));
assert(
  existsSync(path.join(root, 'packages/maps/lib/index.d.ts')),
  'Run npm run build first',
);
const pack = JSON.parse(
  execFileSync(
    'npm',
    ['pack', '--json', '--ignore-scripts', '--pack-destination', output],
    { cwd: path.join(root, 'packages/maps'), encoding: 'utf8' },
  ),
)[0];
const tarball = path.join(output, pack.filename);
const peers = ['react-native-webgpu', 'react-native-worklets'];
const results = {
  schemaVersion: 1,
  bundleFixtureVersion: 2,
  sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: root,
    encoding: 'utf8',
  }).trim(),
  tarballSHA256: createHash('sha256')
    .update(readFileSync(tarball))
    .digest('hex'),
  node: process.version,
  npm: execFileSync('npm', ['--version'], { encoding: 'utf8' }).trim(),
  resolverOverrides: { 'react-native-reanimated': '4.6.0' },
  cases: [],
};
const report = path.join(output, 'verification.json');
save(report, results);
function run(cwd, name, command, parameters, env = {}) {
  const result = spawnSync(command, parameters, {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, ...env },
    maxBuffer: 32 * 1024 * 1024,
  });
  const text =
    (result.stdout ?? '') +
    (result.stderr ?? '') +
    (result.error ? String(result.error) : '');
  writeFileSync(path.join(cwd, name + '.log'), text);
  return { status: result.status, text };
}
function pass(result, label) {
  assert.equal(
    result.status,
    0,
    `${label} failed; inspect the consumer logs under ${output}`,
  );
}
for (const [name, selected] of [
  ['core', []],
  ['webgpu', [peers[0]]],
  ['worklets', [peers[1]]],
  ['shaders', peers],
]) {
  const consumer = path.join(output, name);
  mkdirSync(consumer);
  const record = { name, peers: selected, status: 'running', bundles: [] };
  results.cases.push(record);
  save(report, results);
  const dependencies = {
    react: example.dependencies.react,
    'react-native': example.dependencies['react-native'],
    [manifest.name]: `file:${tarball}`,
    ...Object.fromEntries(
      selected.map((peer) => [peer, example.dependencies[peer]]),
    ),
  };
  const devDependencies = Object.fromEntries(
    Object.keys(example.devDependencies).map((tool) => {
      const version = locked.packages[`node_modules/${tool}`]?.version;
      assert(version, `Missing locked tool ${tool}`);
      return [tool, version];
    }),
  );
  save(path.join(consumer, 'package.json'), {
    name: `maps-peer-${name}`,
    version: '0.0.0',
    private: true,
    dependencies,
    devDependencies,
    overrides: results.resolverOverrides,
  });
  const install = run(consumer, 'install', 'npm', [
    'install',
    '--ignore-scripts',
    '--no-audit',
    '--no-fund',
    ...args,
  ]);
  pass(install, `${name}: normal npm peer resolution`);
  pass(
    run(consumer, 'npm-ls', 'npm', ['ls', '--all', '--json']),
    `${name}: dependency tree`,
  );
  const maps = path.join(consumer, 'node_modules', manifest.name);
  assert(
    !lstatSync(maps).isSymbolicLink(),
    'Maps must be unpacked, not workspace-linked',
  );
  assert(
    realpathSync(maps).startsWith(realpathSync(consumer) + path.sep),
    'Maps resolved outside consumer',
  );
  for (const peer of peers) {
    const file = path.join(consumer, 'node_modules', peer, 'package.json');
    assert.equal(
      existsSync(file),
      selected.includes(peer),
      `${name}: unexpected installed peer ${peer}`,
    );
    if (selected.includes(peer))
      assert.equal(json(file).version, dependencies[peer]);
  }
  writeFileSync(
    path.join(consumer, 'babel.config.js'),
    "module.exports = { presets: ['module:@react-native/babel-preset'], plugins: ['react-native-worklets/plugin'].filter(() => process.env.MAPS_PEER_ENTRY === 'shaders') };\n",
  );
  writeFileSync(
    path.join(consumer, 'metro.config.js'),
    `const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');
module.exports = mergeConfig(getDefaultConfig(__dirname), {resolver: {resolveRequest(context, name, platform) {
  if (process.env.MAPS_PEER_ENTRY === 'core' && ${JSON.stringify(peers)}.some(peer => name === peer || name.startsWith(peer + '/'))) {
    require('node:fs').writeFileSync(__dirname + '/forbidden-peer-imports.json', JSON.stringify({name}));
    throw new Error('Core imported an optional GPU peer');
  }
  return context.resolveRequest(context, name, platform);
}}});\n`,
  );
  writeFileSync(
    path.join(consumer, 'core.tsx'),
    `import MapView, { Marker, Circle } from '${manifest.name}';\nimport type { MapViewProps } from '${manifest.name}';\nconst props: MapViewProps = {styleURL:'https://example.com/style.json'};\nvoid [MapView, Marker, Circle, props];\n`,
  );
  writeFileSync(
    path.join(consumer, 'core.js'),
    `import MapView, { Marker, Circle } from '${manifest.name}';\nconsole.log(MapView, Marker, Circle);\n`,
  );
  writeFileSync(
    path.join(consumer, 'shaders.js'),
    `import MapView, { Marker, Circle } from '${manifest.name}';\nimport { ShaderLayer } from '${manifest.name}/shaders';\nconsole.log(MapView, Marker, Circle, ShaderLayer);\n`,
  );
  writeFileSync(
    path.join(consumer, 'shaders.tsx'),
    `import { ShaderLayer } from '${manifest.name}/shaders';\nimport type { ShaderLayerProps } from '${manifest.name}/shaders';\nconst props: ShaderLayerProps = {id:'test',shaders:{fragment:'fixture'}};\nvoid [ShaderLayer,props];\n`,
  );
  pass(
    run(consumer, 'types', process.execPath, [
      path.join(consumer, 'node_modules/typescript/bin/tsc'),
      '--noEmit',
      '--strict',
      '--skipLibCheck',
      '--moduleResolution',
      'bundler',
      '--module',
      'esnext',
      '--target',
      'es2022',
      '--jsx',
      'react-jsx',
      'core.tsx',
      'shaders.tsx',
    ]),
    `${name}: packed declarations`,
  );
  record.declarations = 'pass';
  const forbidden = path.join(consumer, 'forbidden-peer-imports.json');
  if (name === 'core') {
    // Metro can swallow resolver errors for require() inside try. Prove that
    // our persistent sentinel detects this case even if the bundle succeeds.
    writeFileSync(
      path.join(consumer, 'probe.js'),
      "try { console.log(require('react-native-webgpu')); } catch {}\n",
    );
    run(
      consumer,
      'guard-probe',
      process.execPath,
      [
        path.join(consumer, 'node_modules/react-native/cli.js'),
        'bundle',
        '--platform',
        'ios',
        '--entry-file',
        'probe.js',
        '--dev',
        'false',
        '--max-workers',
        '2',
        '--reset-cache',
        '--bundle-output',
        path.join(consumer, 'probe.jsbundle'),
      ],
      { MAPS_PEER_ENTRY: 'core' },
    );
    assert(
      existsSync(forbidden),
      'Core guard did not detect the optional import probe',
    );
    assert.equal(json(forbidden).name, 'react-native-webgpu');
    rmSync(forbidden);
    record.coreGuard = 'verified-with-optional-import-probe';
  }
  for (const entry of ['core', 'shaders']) {
    for (const platform of ['ios', 'android']) {
      const label = `${entry}-${platform}`;
      const bundle = path.join(consumer, `${label}.jsbundle`);
      const result = run(
        consumer,
        label,
        process.execPath,
        [
          path.join(consumer, 'node_modules/react-native/cli.js'),
          'bundle',
          '--platform',
          platform,
          '--entry-file',
          `${entry}.js`,
          '--dev',
          'false',
          '--max-workers',
          '2',
          '--reset-cache',
          '--bundle-output',
          bundle,
        ],
        {
          MAPS_PEER_ENTRY:
            entry === 'core'
              ? 'core'
              : selected.length === 2
                ? 'shaders'
                : 'missing',
        },
      );
      if (entry === 'core')
        assert(
          !existsSync(forbidden),
          `${name}: core attempted a GPU peer import`,
        );
      if (entry === 'core' || selected.length === 2)
        pass(result, `${name}: ${label}`);
      if (result.status === 0) {
        assertReleaseBundle(readFileSync(bundle, 'utf8'));
        record.bundles.push({
          entry,
          platform,
          status:
            entry === 'shaders' && selected.length < 2
              ? 'bundled-with-missing-runtime-peers'
              : 'pass',
        });
      } else {
        // A compiler/plugin/setup error must not count as expected missing-peer rejection.
        const missing = peers.filter((peer) => !selected.includes(peer));
        const unresolved = result.text.match(
          /Unable to resolve module (react-native-(?:webgpu|worklets)) from/,
        )?.[1];
        assert(
          missing.includes(unresolved),
          `${name}: shader rejection was not an exact omitted-peer resolution error`,
        );
        record.bundles.push({
          entry,
          platform,
          status: 'expected-missing-peer',
        });
      }
      save(report, results);
    }
  }
  record.status = 'pass';
  save(report, results);
  console.log(
    `${name}: install, dependency tree, declarations and bundles verified`,
  );
}
console.log(`Optional peer verification passed: ${report}`);
