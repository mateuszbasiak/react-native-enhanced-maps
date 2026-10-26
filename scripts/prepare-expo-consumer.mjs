import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = process.argv[2]
  ? path.resolve(process.argv[2])
  : mkdtempSync(path.join(tmpdir(), 'enhanced-maps-expo-'));
mkdirSync(output, { recursive: true });
assert.equal(
  readdirSync(output).length,
  0,
  'Expo consumer output must be empty',
);
const run = (command, args, cwd = output) =>
  execFileSync(command, args, {
    cwd,
    stdio: 'inherit',
    env: { ...process.env, CI: '1' },
  });
const pack = (args, cwd) => {
  const [result] = JSON.parse(
    execFileSync(
      'npm',
      [
        'pack',
        ...args,
        '--json',
        '--ignore-scripts',
        '--pack-destination',
        output,
      ],
      { cwd, encoding: 'utf8' },
    ),
  );
  return result.filename;
};
const maps = pack([], path.join(root, 'packages/maps'));
const template = pack(['expo-template-bare-minimum@56.0.38'], output);
const manifest = {
  name: 'enhanced-maps-expo-consumer',
  version: '1.0.0',
  private: true,
  main: 'index.js',
  dependencies: {
    expo: '56.0.24',
    'expo-dev-client': '56.0.28',
    react: '19.2.3',
    'react-native': '0.85.3',
    'react-native-enhanced-maps': `file:./${maps}`,
  },
  devDependencies: {
    '@babel/core': '^7.25.2',
    'babel-preset-expo': '56.0.21',
    typescript: '5.9.3',
    '@types/react': '19.2.14',
  },
  overrides: { 'react-native-reanimated': '4.6.0' },
};
writeFileSync(
  path.join(output, 'package.json'),
  JSON.stringify(manifest, null, 2) + '\n',
);
writeFileSync(
  path.join(output, 'app.json'),
  JSON.stringify(
    {
      expo: {
        name: 'Enhanced Maps Expo',
        slug: 'enhanced-maps-expo-consumer',
        version: '1.0.0',
        ios: { bundleIdentifier: 'org.enhancedmaps.expoconsumer' },
        android: { package: 'com.enhancedmaps.expoconsumer' },
        plugins: ['react-native-enhanced-maps'],
      },
    },
    null,
    2,
  ) + '\n',
);
for (const name of ['App.tsx', 'index.js', 'babel.config.cjs'])
  copyFileSync(
    path.join(root, 'scripts/fixtures/expo', name),
    path.join(output, name),
  );
run('npm', ['install', '--no-audit', '--no-fund']);
const expo = path.join(output, 'node_modules/expo/bin/cli');
run(process.execPath, [
  expo,
  'prebuild',
  '--clean',
  '--no-install',
  '--template',
  path.join(output, template),
]);
console.log(
  `Expo consumer prepared at ${output}. Native dependency installation, builds and runtime checks remain separate.`,
);
