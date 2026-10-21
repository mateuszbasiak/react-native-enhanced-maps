import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

test('scene transport retains explicit safe-integer revisions without versioning implicit sources or shapes', async () => {
  const moduleURL = new URL(
    '../packages/maps/lib/maplibreContent.js',
    import.meta.url,
  );
  const code = readFileSync(moduleURL, 'utf8')
    .replace("from 'react'", `from '${import.meta.resolve('react')}'`)
    .replace(
      /from '(\.\/[^']+)'/g,
      (_, path) => `from '${new URL(path + '.js', moduleURL).href}'`,
    );
  const { compileScene, GeoJSONSource } = await import(
    `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`
  );
  const { Polyline } = await import('../packages/maps/lib/mapContent.js');
  const data = { type: 'FeatureCollection', features: [] };
  const source = (id, revision) =>
    React.createElement(GeoJSONSource, {
      id,
      data,
      ...(revision === undefined ? {} : { revision }),
    });
  const scene = JSON.parse(
    compileScene([
      source('explicit', Number.MAX_SAFE_INTEGER),
      source('zero', 0),
      source('implicit'),
      React.createElement(Polyline, {
        id: 'shape',
        coordinates: [
          { latitude: 1, longitude: 1 },
          { latitude: 2, longitude: 2 },
        ],
      }),
    ]).json,
  );
  assert.equal(scene.sources[0].revision, Number.MAX_SAFE_INTEGER);
  assert.equal(scene.sources[1].revision, 0);
  assert.equal(Object.hasOwn(scene.sources[2], 'revision'), false);
  assert.equal(Object.hasOwn(scene.sources[3], 'revision'), false);
  for (const revision of [-1, 0.5, Infinity, NaN, Number.MAX_SAFE_INTEGER + 1])
    assert.throws(() => compileScene(source('invalid', revision)), /revision/);
});

const output = path.resolve('artifacts/native-tests');
mkdirSync(output, { recursive: true });
test('Android native revision gate preserves accepted batches and source lifetimes', () => {
  execFileSync(
    'javac',
    [
      '-d',
      output,
      'packages/maps/android/src/main/java/com/enhancedmaps/SourceRevisionGate.java',
      'tests/native/SourceRevisionGateTest.java',
    ],
    { stdio: 'pipe' },
  );
  assert.doesNotThrow(() =>
    execFileSync('java', ['-cp', output, 'SourceRevisionGateTest']),
  );
});
test('iOS native revision gate obeys the same replacement and lifetime contract', () => {
  const binary = path.join(output, 'source-revision-gate');
  execFileSync(
    'c++',
    [
      '-std=c++17',
      '-Ipackages/maps/ios',
      'tests/native/SourceRevisionGateTest.cpp',
      '-o',
      binary,
    ],
    { stdio: 'pipe' },
  );
  assert.doesNotThrow(() => execFileSync(binary));
});
