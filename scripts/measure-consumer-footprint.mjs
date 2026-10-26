import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const json = (file) => JSON.parse(readFileSync(file, 'utf8'));
const sha256 = (data) => createHash('sha256').update(data).digest('hex');
function payloadBytes(directory) {
  let bytes = 0;
  for (const name of readdirSync(directory)) {
    if (name === 'node_modules') continue;
    const file = path.join(directory, name),
      stat = lstatSync(file);
    if (stat.isFile()) bytes += stat.size;
    else if (stat.isDirectory()) bytes += payloadBytes(file);
  }
  return bytes;
}
function installedPackages(directory, consumer, results = []) {
  for (const name of readdirSync(directory).sort()) {
    if (name.startsWith('.')) continue;
    const file = path.join(directory, name);
    if (!lstatSync(file).isDirectory()) continue;
    if (name.startsWith('@')) {
      installedPackages(file, consumer, results);
      continue;
    }
    const manifest = json(path.join(file, 'package.json'));
    results.push({
      name: manifest.name,
      version: manifest.version,
      location: path.relative(consumer, file),
      payloadBytes: payloadBytes(file),
    });
    if (readdirSync(file).includes('node_modules'))
      installedPackages(path.join(file, 'node_modules'), consumer, results);
  }
  return results;
}

/** Logical installed file bytes, not allocated disk blocks or native app size. */
export function measureConsumerFootprint(directory) {
  const verification = json(path.join(directory, 'verification.json'));
  assert.equal(
    verification.bundleFixtureVersion,
    2,
    'Rerun the peer matrix with comparable core-plus-shader fixtures',
  );
  const names = ['core', 'webgpu', 'worklets', 'shaders'];
  assert.equal(
    verification.cases.length,
    names.length,
    'Expected the complete four-consumer matrix',
  );
  const tarballs = readdirSync(directory).filter((name) =>
    name.endsWith('.tgz'),
  );
  assert.equal(tarballs.length, 1, 'Expected the verified maps tarball');
  const tarball = readFileSync(path.join(directory, tarballs[0]));
  assert.equal(
    sha256(tarball),
    verification.tarballSHA256,
    'Maps tarball changed since verification',
  );
  const cases = names.map((name) => {
    const record = verification.cases.find((item) => item.name === name);
    assert.equal(
      record?.status,
      'pass',
      `Consumer ${name} has not passed verification`,
    );
    const consumer = path.join(directory, name);
    const packages = installedPackages(
      path.join(consumer, 'node_modules'),
      consumer,
    );
    const bundles = record.bundles
      .filter((item) => item.status === 'pass')
      .map((item) => {
        const buffer = readFileSync(
          path.join(consumer, `${item.entry}-${item.platform}.jsbundle`),
        );
        return {
          entry: item.entry,
          platform: item.platform,
          rawBytes: buffer.length,
          gzip9Bytes: gzipSync(buffer, { level: 9 }).length,
          sha256: sha256(buffer),
        };
      });
    return {
      name,
      installedPayloadBytes: packages.reduce(
        (sum, item) => sum + item.payloadBytes,
        0,
      ),
      packages,
      bundles,
      lockfileSHA256: sha256(
        readFileSync(path.join(consumer, 'package-lock.json')),
      ),
    };
  });
  const core = cases.find((item) => item.name === 'core');
  const shaders = cases.find((item) => item.name === 'shaders');
  const bundleDeltas = ['ios', 'android'].map((platform) => {
    const base = core.bundles.find(
      (item) => item.entry === 'core' && item.platform === platform,
    );
    const gpu = shaders.bundles.find(
      (item) => item.entry === 'shaders' && item.platform === platform,
    );
    assert(base && gpu, `Missing verified ${platform} comparison bundles`);
    return {
      platform,
      rawBytes: gpu.rawBytes - base.rawBytes,
      gzip9Bytes: gpu.gzip9Bytes - base.gzip9Bytes,
    };
  });
  const coreIdentities = new Set(
    core.packages.map((item) => `${item.name}@${item.version}`),
  );
  return {
    schemaVersion: 1,
    bundleFixtureVersion: verification.bundleFixtureVersion,
    sourceCommit: verification.sourceCommit,
    node: verification.node,
    npm: verification.npm,
    tarball: {
      name: tarballs[0],
      bytes: tarball.length,
      sha256: sha256(tarball),
    },
    method:
      'Regular package-file bytes; nested node_modules counted separately; symlinks excluded. Bundles measured as UTF-8 file bytes and gzip level 9. Includes development tools in installation totals.',
    cases,
    comparison: {
      installedPayloadDeltaBytes:
        shaders.installedPayloadBytes - core.installedPayloadBytes,
      addedPackageIdentities: shaders.packages.filter(
        (item) => !coreIdentities.has(`${item.name}@${item.version}`),
      ),
      bundleDeltas,
    },
  };
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  assert.equal(
    process.argv.length,
    3,
    'Usage: npm run measure:consumer-footprint -- MATRIX_DIRECTORY',
  );
  const directory = path.resolve(process.argv[2]);
  const result = measureConsumerFootprint(directory);
  const output = path.join(directory, 'footprint.json');
  writeFileSync(output, JSON.stringify(result, null, 2) + '\n');
  console.log(`Consumer footprint report: ${output}`);
  console.log(
    `Shader peer payload delta: ${result.comparison.installedPayloadDeltaBytes} bytes`,
  );
  for (const item of result.comparison.bundleDeltas)
    console.log(
      `${item.platform}: shader bundle adds ${item.rawBytes} raw / ${item.gzip9Bytes} gzip-9 bytes`,
    );
}
