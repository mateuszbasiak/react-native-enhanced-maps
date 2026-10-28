import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const input = process.argv.slice(2);
for (const option of input.filter((arg) => arg.startsWith('--')))
  assert(option === '--shaders', `Unknown option: ${option}`);
const shaders = input.includes('--shaders');
const paths = input.filter((arg) => arg !== '--shaders');
assert(paths.length <= 1, 'Expected at most one output directory');
const output = paths[0]
  ? path.resolve(paths[0])
  : mkdtempSync(path.join(os.tmpdir(), 'enhanced-maps-consumer-'));
assert(
  !output.startsWith(root + path.sep),
  'Native consumer must live outside the workspace',
);
if (paths[0]) {
  assert(
    !existsSync(output),
    'Refusing to overwrite an existing consumer directory',
  );
  mkdirSync(output, { recursive: true });
}
assert(
  existsSync(path.join(root, 'packages/maps/lib/index.js')),
  'Run npm run build first',
);
const pack = JSON.parse(
  execFileSync(
    'npm',
    ['pack', '--json', '--ignore-scripts', '--pack-destination', output],
    {
      cwd: path.join(root, 'packages/maps'),
      encoding: 'utf8',
      env: {
        ...process.env,
        npm_config_cache: path.join(output, '.npm-cache'),
      },
    },
  ),
)[0];
const example = path.join(root, 'example');
const excluded = new Set([
  'build',
  'Pods',
  '.gradle',
  '.cxx',
  'DerivedData',
  'node_modules',
  'Podfile.lock',
  'local.properties',
  'maps.local.properties',
  'Maps.local.xcconfig',
  '.xcode.env.local',
]);
for (const directory of ['android', 'ios'])
  cpSync(path.join(example, directory), path.join(output, directory), {
    recursive: true,
    filter: (source) =>
      !excluded.has(path.basename(source)) && !source.endsWith('.xcworkspace'),
  });
for (const file of [
  'index.js',
  'app.json',
  'tsconfig.json',
  'Gemfile',
  'Gemfile.lock',
])
  if (existsSync(path.join(example, file)))
    cpSync(path.join(example, file), path.join(output, file));
const original = JSON.parse(
  readFileSync(path.join(example, 'package.json'), 'utf8'),
);
const locked = JSON.parse(
  readFileSync(path.join(root, 'package-lock.json'), 'utf8'),
);
const devDependencies = Object.fromEntries(
  Object.keys(original.devDependencies).map((name) => {
    const version = locked.packages[`node_modules/${name}`]?.version;
    assert(version, `Missing locked consumer tool: ${name}`);
    return [name, version];
  }),
);
// Constrain npm's optional peer search for the pinned Worklets baseline.
const resolverOverrides = { 'react-native-reanimated': '4.6.0' };
const manifest = {
  name: 'enhanced-maps-native-consumer',
  version: '0.0.0',
  private: true,
  dependencies: {
    react: original.dependencies.react,
    'react-native': original.dependencies['react-native'],
    'react-native-maplibre-maps': `file:./${pack.filename}`,
    ...(shaders
      ? {
          'react-native-webgpu': original.dependencies['react-native-webgpu'],
          'react-native-worklets':
            original.dependencies['react-native-worklets'],
        }
      : {}),
  },
  devDependencies,
  overrides: resolverOverrides,
};
writeFileSync(
  path.join(output, 'package.json'),
  JSON.stringify(manifest, null, 2) + '\n',
);
writeFileSync(
  path.join(output, 'babel.config.js'),
  `module.exports = { presets: ['module:@react-native/babel-preset']${shaders ? ", plugins: ['react-native-worklets/plugin']" : ''} };\n`,
);
writeFileSync(
  path.join(output, 'metro.config.js'),
  "const { getDefaultConfig } = require('@react-native/metro-config');\nmodule.exports = getDefaultConfig(__dirname);\n",
);
writeFileSync(
  path.join(output, 'App.tsx'),
  `import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { MapView, Marker, Circle } from 'react-native-maplibre-maps';
export default function App() {
  const [status, setStatus] = useState('Packed map loading');
  return <View style={{flex:1}}><Text testID="packed-status">{status}</Text><MapView onMapReady={() => setStatus('Packed map ready')} onError={error => setStatus('Packed map error: '+error.code)} style={{flex:1}} styleURL="https://tiles.openfreemap.org/styles/liberty" initialCamera={{center:{latitude:54.37,longitude:18.66},zoom:12,heading:0,pitch:0}}>
    <Marker id="packed-marker" coordinate={{latitude:54.37,longitude:18.66}}><Text>Packed core map</Text></Marker>
    <Circle id="packed-circle" center={{latitude:54.37,longitude:18.66}} radius={100} fillColor="#3388ff" />
  </MapView></View>;
}
`,
);
if (shaders)
  cpSync(
    path.join(root, 'scripts/fixtures/native-gpu/App.tsx'),
    path.join(output, 'App.tsx'),
  );
const replace = (file, transform) => {
  const target = path.join(output, file);
  writeFileSync(target, transform(readFileSync(target, 'utf8')));
};
replace('android/build.gradle', (s) =>
  shaders ? s : s.replace('minSdkVersion = 26', 'minSdkVersion = 24'),
);
replace('android/settings.gradle', (s) =>
  s.replaceAll('../../node_modules', '../node_modules'),
);
replace('android/app/build.gradle', (s) =>
  s
    .replaceAll('../../../node_modules', '../../node_modules')
    .replace(
      'npm workspaces hoist Hermes outside the example root searched by Gradle.',
      'Use the pinned compiler from this consumer installation.',
    ),
);
replace('ios/Podfile', (s) =>
  s.replace(
    "require_relative '../../packages/maps/maplibre-spm'",
    "require_relative '../node_modules/react-native-maplibre-maps/maplibre-spm'",
  ),
);
replace('ios/EnhancedMapsExample.xcodeproj/project.pbxproj', (s) =>
  s.replaceAll(
    '${PODS_ROOT}/../../../node_modules',
    '${PODS_ROOT}/../../node_modules',
  ),
);
if (shaders) {
  replace('android/app/build.gradle', (s) =>
    s.replace(
      'applicationId "com.enhancedmapsexample"',
      'applicationId "com.enhancedmaps.gpuconsumer"',
    ),
  );
  replace('ios/EnhancedMapsExample.xcodeproj/project.pbxproj', (s) =>
    s.replaceAll(
      /PRODUCT_BUNDLE_IDENTIFIER = .*?;/g,
      'PRODUCT_BUNDLE_IDENTIFIER = com.enhancedmaps.gpuconsumer;',
    ),
  );
}
writeFileSync(
  path.join(output, 'ios/.xcode.env.local'),
  `export NODE_BINARY=${JSON.stringify(process.execPath)}\n`,
);
writeFileSync(
  path.join(output, 'verification.json'),
  JSON.stringify(
    {
      schemaVersion: 1,
      sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], {
        cwd: root,
        encoding: 'utf8',
      }).trim(),
      tarball: pack.filename,
      reactNative: manifest.dependencies['react-native'],
      optionalPeers: shaders
        ? ['react-native-webgpu', 'react-native-worklets']
        : [],
      appIdentifier: shaders ? 'com.enhancedmaps.gpuconsumer' : undefined,
      resolverOverrides,
      tarballSHA256: createHash('sha256')
        .update(readFileSync(path.join(output, pack.filename)))
        .digest('hex'),
      status: 'prepared',
    },
    null,
    2,
  ) + '\n',
);
console.log(output);
