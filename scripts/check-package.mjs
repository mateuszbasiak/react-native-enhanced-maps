import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const output = path.join(root, 'artifacts/packages');
mkdirSync(output, { recursive: true });
const npmEnv = {
  ...process.env,
  npm_config_cache: path.join(output, 'npm-cache'),
};
const tarballs = [];
for (const directory of ['maps']) {
  const result = JSON.parse(
    execFileSync(
      'npm',
      ['pack', '--json', '--ignore-scripts', '--pack-destination', output],
      {
        cwd: path.join(root, 'packages', directory),
        encoding: 'utf8',
        env: npmEnv,
      },
    ),
  )[0];
  const files = result.files.map((file) => file.path);
  for (const required of [
    'lib/index.js',
    'lib/index.d.ts',
    'src/index.ts',
    'README.md',
    'docs/api.md',
  ])
    assert(files.includes(required), `${directory}: missing ${required}`);
  assert(
    !files.some((file) =>
      /node_modules|type-tests|\.env|artifacts|(^|\/)(build|\.gradle|\.cxx)(\/|$)/.test(
        file,
      ),
    ),
    'Unexpected private/build files',
  );
  if (directory === 'maps') {
    for (const required of [
      'EnhancedMaps.podspec',
      'react-native.config.cjs',
      'ios/EMMapLibreView.mm',
      'ios/EMMarkerView.mm',
      'maplibre-spm.rb',
      'android/build.gradle',
    ])
      assert(files.includes(required), `Missing native source: ${required}`);
  }
  const manifest = JSON.parse(
    readFileSync(
      path.join(root, 'packages', directory, 'package.json'),
      'utf8',
    ),
  );
  assert.deepEqual(
    manifest.dependencies,
    { '@react-native/normalize-colors': '0.85.3' },
    `${directory}: unexpected runtime dependency or unreviewed version`,
  );
  tarballs.push(path.join(output, result.filename));
  console.log(
    `${manifest.name}: ${result.size} bytes packed; ${result.unpackedSize} bytes unpacked`,
  );
}
// Supply the already locked runtime helper as a tarball too, keeping this
// declaration check offline without relying on a registry packument cache.
const colorRoot = path.join(
  root,
  'node_modules/@react-native/normalize-colors',
);
assert.equal(
  JSON.parse(readFileSync(path.join(colorRoot, 'package.json'), 'utf8'))
    .version,
  '0.85.3',
);
const colorPack = JSON.parse(
  execFileSync(
    'npm',
    ['pack', '--json', '--ignore-scripts', '--pack-destination', output],
    { cwd: colorRoot, encoding: 'utf8', env: npmEnv },
  ),
)[0];
tarballs.push(path.join(output, colorPack.filename));
// Consumer is independent of workspace package symlinks. Peer types resolve from the
// development toolchain; this is a declaration test, not a clean native installation.
const consumer = mkdtempSync(path.join(output, 'consumer-'));
writeFileSync(
  path.join(consumer, 'package.json'),
  JSON.stringify({ private: true, type: 'module' }),
);
execFileSync(
  'npm',
  [
    'install',
    '--offline',
    '--ignore-scripts',
    '--legacy-peer-deps',
    '--package-lock=false',
    '--no-audit',
    '--no-fund',
    ...tarballs,
  ],
  { cwd: consumer, stdio: 'pipe', env: npmEnv },
);
writeFileSync(
  path.join(consumer, 'consumer.ts'),
  `import type { Camera, MapViewProps } from 'react-native-enhanced-maps';\nimport { ShaderLayer } from 'react-native-enhanced-maps/shaders';\nvoid ShaderLayer;\ndeclare const camera: Camera;\nconst props: MapViewProps = { styleURL: 'https://example.com/style.json', initialCamera: camera };\nvoid props;\n`,
);
execFileSync(
  process.execPath,
  [
    path.join(root, 'node_modules/typescript/bin/tsc'),
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
    'consumer.ts',
  ],
  { cwd: consumer, stdio: 'inherit' },
);
console.log(
  'Packed consumer declaration resolution passed. Native consumer builds are separate checks.',
);
