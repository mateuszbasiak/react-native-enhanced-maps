import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const output = path.join(root, 'artifacts/packages');
mkdirSync(output, { recursive: true });
const npmEnv = { ...process.env, npm_config_cache: path.join(output, 'npm-cache') };
const tarballs = [];
for (const directory of ['maps', 'typegpu']) {
  const result = JSON.parse(execFileSync('npm', ['pack', '--json', '--ignore-scripts', '--pack-destination', output], { cwd: path.join(root, 'packages', directory), encoding: 'utf8', env: npmEnv }))[0];
  const files = result.files.map(file => file.path);
  for (const required of ['lib/index.js', 'lib/index.d.ts', 'src/index.ts', 'README.md']) assert(files.includes(required), `${directory}: missing ${required}`);
  assert(!files.some(file => /node_modules|type-tests|\.env|artifacts|(^|\/)(build|\.gradle|\.cxx)(\/|$)/.test(file)), 'Unexpected private/build files');
  if (directory === 'maps') {
    for (const required of ['EnhancedMaps.podspec', 'react-native.config.cjs', 'ios/EMMapView.mm', 'android/build.gradle']) assert(files.includes(required), `Missing native source: ${required}`);
  }
  const manifest = JSON.parse(readFileSync(path.join(root, 'packages', directory, 'package.json'), 'utf8'));
  assert.equal(Object.keys(manifest.dependencies ?? {}).length, 0, `${directory}: runtime dependency needs review`);
  tarballs.push(path.join(output, result.filename));
  console.log(`${manifest.name}: ${result.size} bytes packed; ${result.unpackedSize} bytes unpacked`);
}
// Consumer is independent of workspace package symlinks. Peer types resolve from the
// development toolchain; this is a declaration test, not a clean native installation.
const consumer = mkdtempSync(path.join(output, 'consumer-'));
writeFileSync(path.join(consumer, 'package.json'), JSON.stringify({ private: true, type: 'module' }));
execFileSync('npm', ['install', '--offline', '--ignore-scripts', '--legacy-peer-deps', '--package-lock=false', '--no-audit', '--no-fund', ...tarballs], { cwd: consumer, stdio: 'pipe', env: npmEnv });
writeFileSync(path.join(consumer, 'consumer.ts'), `import type { Camera, MapViewProps } from 'react-native-enhanced-maps';\nimport type { MapGpuFrame } from '@react-native-enhanced-maps/typegpu';\ndeclare const camera: Camera;\nconst props: MapViewProps = { provider: 'google', initialCamera: camera };\ndeclare const frame: MapGpuFrame;\nconst width: number = frame.widthPixels;\nvoid props; void width;\n`);
execFileSync(process.execPath, [path.join(root, 'node_modules/typescript/bin/tsc'), '--noEmit', '--strict', '--skipLibCheck', '--moduleResolution', 'bundler', '--module', 'esnext', '--target', 'es2022', '--jsx', 'react-jsx', 'consumer.ts'], { cwd: consumer, stdio: 'inherit' });
console.log('Packed consumer declaration resolution passed. Native consumer builds are separate checks.');
