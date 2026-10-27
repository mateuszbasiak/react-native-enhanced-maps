import { test } from 'node:test';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import React from 'react';
import { fixtures } from './fixtures/nativeScene.mjs';
const output = 'artifacts/native-tests/scene';
async function load(module) {
  const url = new URL(`../packages/maps/lib/${module}.js`, import.meta.url);
  const code = readFileSync(url, 'utf8')
    .replace("from 'react'", `from '${import.meta.resolve('react')}'`)
    .replace(
      /from '(\.\/[^']+)'/g,
      (_, path) => `from '${new URL(path + '.js', url).href}'`,
    );
  return import(
    `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`
  );
}
const { compileScene } = await load('maplibreContent');
const { Circle, Polyline, Polygon } =
  await import('../packages/maps/lib/mapContent.js');
for (const [label, component, props] of [
  [
    'dateline circle',
    Circle,
    { center: { latitude: 0, longitude: 179.9 }, radius: 30000 },
  ],
  [
    'gradient geodesic',
    Polyline,
    {
      coordinates: [
        { latitude: 1, longitude: 179 },
        { latitude: 2, longitude: -179 },
      ],
      geodesic: true,
      strokeColors: ['#ff0000', '#0000ff'],
    },
  ],
  [
    'long ID polygon',
    Polygon,
    {
      id: 'a'.repeat(128),
      coordinates: [
        { latitude: 0, longitude: 0 },
        { latitude: 1, longitude: 0 },
        { latitude: 0, longitude: 1 },
      ],
    },
  ],
])
  fixtures.push({
    label,
    scene: JSON.parse(compileScene(React.createElement(component, props)).json),
    accepted: true,
  });
mkdirSync(output, { recursive: true });
writeFileSync(output + '/fixtures.json', JSON.stringify(fixtures));
const chunks = [];
function size(n) {
  const b = Buffer.alloc(4);
  b.writeUInt32BE(n);
  chunks.push(b);
}
function encode(v) {
  if (v === null) chunks.push(Buffer.from([0]));
  else if (typeof v === 'boolean') chunks.push(Buffer.from([v ? 2 : 1]));
  else if (typeof v === 'number') {
    const b = Buffer.alloc(9);
    b[0] = 3;
    b.writeDoubleBE(v, 1);
    chunks.push(b);
  } else if (typeof v === 'string') {
    const b = Buffer.from(v);
    chunks.push(Buffer.from([4]));
    size(b.length);
    chunks.push(b);
  } else if (Array.isArray(v)) {
    chunks.push(Buffer.from([5]));
    size(v.length);
    v.forEach(encode);
  } else {
    chunks.push(Buffer.from([6]));
    size(Object.keys(v).length);
    for (const [k, x] of Object.entries(v)) {
      encode(k);
      encode(x);
    }
  }
}
encode(fixtures);
writeFileSync(output + '/fixtures.bin', Buffer.concat(chunks));
test('Android scene preflight enforces graph and style boundaries', () => {
  execFileSync('javac', [
    '-d',
    output,
    'packages/maps/android/src/main/java/com/enhancedmaps/GeoJSONValidation.java',
    'packages/maps/android/src/main/java/com/enhancedmaps/SceneValidation.java',
    'tests/native/GeoJSONValidationTest.java',
    'tests/native/SceneValidationTest.java',
  ]);
  execFileSync('java', [
    '-cp',
    output,
    'SceneValidationTest',
    output + '/fixtures.bin',
  ]);
});
test(
  'Foundation scene preflight enforces the same graph and style boundaries',
  { skip: process.platform !== 'darwin' },
  () => {
    execFileSync('clang', [
      '-fobjc-arc',
      '-framework',
      'Foundation',
      '-Ipackages/maps/ios',
      'tests/native/SceneValidationTest.m',
      '-o',
      output + '/scene-validation',
    ]);
    execFileSync(output + '/scene-validation', [output + '/fixtures.json']);
  },
);
