import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  symlinkSync,
  rmSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { gzipSync } from 'node:zlib';
import { measureConsumerFootprint } from '../scripts/measure-consumer-footprint.mjs';

function fixture() {
  const root = mkdtempSync(path.join(os.tmpdir(), 'maps-footprint-test-'));
  const tarball = Buffer.from('packed maps fixture');
  writeFileSync(path.join(root, 'maps.tgz'), tarball);
  const core = Buffer.from('core application code '.repeat(100));
  const shader = Buffer.concat([
    core,
    Buffer.from('shader runtime code '.repeat(80)),
  ]);
  let added = 0;
  const records = [];
  for (const name of ['core', 'webgpu', 'worklets', 'shaders']) {
    const consumer = path.join(root, name);
    mkdirSync(path.join(consumer, 'node_modules'), { recursive: true });
    const addPackage = (location, packageName, bytes) => {
      const directory = path.join(consumer, 'node_modules', location);
      mkdirSync(directory, { recursive: true });
      const manifest = JSON.stringify({ name: packageName, version: '1.0.0' });
      writeFileSync(path.join(directory, 'package.json'), manifest);
      writeFileSync(path.join(directory, 'payload.bin'), Buffer.alloc(bytes));
      return Buffer.byteLength(manifest) + bytes;
    };
    addPackage('maps', 'maps', 100);
    if (name === 'shaders') {
      added += addPackage('@gpu/runtime', '@gpu/runtime', 60);
      added += addPackage('@gpu/runtime/node_modules/native', 'native', 40);
      symlinkSync(
        path.join(root, 'maps.tgz'),
        path.join(consumer, 'node_modules/@gpu/runtime/linked-file'),
      );
    }
    writeFileSync(path.join(consumer, 'package-lock.json'), '{}');
    const bundles = [];
    for (const platform of ['ios', 'android']) {
      writeFileSync(path.join(consumer, `core-${platform}.jsbundle`), core);
      bundles.push({ entry: 'core', platform, status: 'pass' });
      if (name === 'shaders') {
        writeFileSync(
          path.join(consumer, `shaders-${platform}.jsbundle`),
          shader,
        );
        bundles.push({ entry: 'shaders', platform, status: 'pass' });
      }
    }
    records.push({ name, status: 'pass', bundles });
  }
  const verification = {
    bundleFixtureVersion: 2,
    sourceCommit: 'fixture',
    node: process.version,
    npm: 'fixture',
    cases: records,
    tarballSHA256: createHash('sha256').update(tarball).digest('hex'),
  };
  writeFileSync(
    path.join(root, 'verification.json'),
    JSON.stringify(verification),
  );
  return { root, core, shader, added, verification };
}
test('consumer footprint counts nested payload once and measures actual raw/gzip deltas', () => {
  const input = fixture();
  try {
    const result = measureConsumerFootprint(input.root);
    assert.equal(result.comparison.installedPayloadDeltaBytes, input.added);
    assert.deepEqual(
      result.comparison.addedPackageIdentities.map((item) => item.name),
      ['@gpu/runtime', 'native'],
    );
    for (const delta of result.comparison.bundleDeltas) {
      assert.equal(delta.rawBytes, input.shader.length - input.core.length);
      assert.equal(
        delta.gzip9Bytes,
        gzipSync(input.shader, { level: 9 }).length -
          gzipSync(input.core, { level: 9 }).length,
      );
    }
  } finally {
    rmSync(input.root, { recursive: true });
  }
});
test('consumer footprint does not report incomplete verification or a changed tarball', () => {
  const input = fixture();
  try {
    input.verification.bundleFixtureVersion = 1;
    writeFileSync(
      path.join(input.root, 'verification.json'),
      JSON.stringify(input.verification),
    );
    assert.throws(
      () => measureConsumerFootprint(input.root),
      /comparable core-plus-shader fixtures/,
    );
    input.verification.bundleFixtureVersion = 2;
    input.verification.cases[3].status = 'running';
    writeFileSync(
      path.join(input.root, 'verification.json'),
      JSON.stringify(input.verification),
    );
    assert.throws(
      () => measureConsumerFootprint(input.root),
      /has not passed verification/,
    );
    input.verification.cases[3].status = 'pass';
    writeFileSync(
      path.join(input.root, 'verification.json'),
      JSON.stringify(input.verification),
    );
    writeFileSync(path.join(input.root, 'maps.tgz'), 'different package');
    assert.throws(
      () => measureConsumerFootprint(input.root),
      /tarball changed/,
    );
  } finally {
    rmSync(input.root, { recursive: true });
  }
});
