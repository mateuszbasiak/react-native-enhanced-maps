import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { nativeGeoJSONFixtures } from './fixtures/nativeGeoJSON.mjs';
import React from 'react';
import {
  compileMapContent,
  Polyline,
} from '../packages/maps/lib/mapContent.js';
import { nativeShapes } from '../packages/maps/lib/nativeShapes.js';

const output = path.resolve('artifacts/native-tests/geojson');
mkdirSync(output, { recursive: true });
const fixtures = nativeGeoJSONFixtures();
test('generated shape transport explicitly declares its unwrapped coordinate space', () => {
  const scene = nativeShapes(
    compileMapContent(
      React.createElement(Polyline, {
        id: 'generated',
        geodesic: true,
        coordinates: [
          { latitude: 0, longitude: 179 },
          { latitude: 0, longitude: -179 },
        ],
      }),
    ),
    { sources: [], layers: [] },
  );
  assert.equal(scene.sources[0].coordinateSpace, 'unwrapped');
});
test('combined scene serialization tags generated shapes without relaxing authored GeoJSON', async () => {
  const url = new URL(
    '../packages/maps/lib/maplibreContent.js',
    import.meta.url,
  );
  const code = readFileSync(url, 'utf8')
    .replace("from 'react'", `from '${import.meta.resolve('react')}'`)
    .replace(
      /from '(\.\/[^']+)'/g,
      (_, name) => `from '${new URL(name + '.js', url).href}'`,
    );
  const { compileScene, InternalSource } = await import(
    'data:text/javascript;base64,' + Buffer.from(code).toString('base64')
  );
  const authored = React.createElement(InternalSource, {
    id: 'authored',
    coordinateSpace: 'unwrapped',
    data: { type: 'FeatureCollection', features: [] },
  });
  const shape = React.createElement(Polyline, {
    id: 'generated',
    geodesic: true,
    coordinates: [
      { latitude: 0, longitude: 179 },
      { latitude: 0, longitude: -179 },
    ],
  });
  const scene = JSON.parse(compileScene([authored, shape]).json);
  assert.equal(
    scene.sources.find((s) => s.id === 'generated').coordinateSpace,
    'unwrapped',
  );
  assert.equal(
    scene.sources.find((s) => s.id === 'authored').coordinateSpace,
    undefined,
  );
});
// Exercise the exact Overlay footprint through both native geometry validators.
const overlayURL = new URL(
  '../packages/maps/lib/maplibreContent.js',
  import.meta.url,
);
const overlayCode = readFileSync(overlayURL, 'utf8')
  .replace("from 'react'", `from '${import.meta.resolve('react')}'`)
  .replace(
    /from '(\.\/[^']+)'/g,
    (_, name) => `from '${new URL(name + '.js', overlayURL).href}'`,
  );
const { compileScene: compileOverlayScene } = await import(
  'data:text/javascript;base64,' + Buffer.from(overlayCode).toString('base64')
);
const { Overlay } = await import('../packages/maps/lib/imageOverlay.js');
const overlayFootprint = JSON.parse(
  compileOverlayScene(
    React.createElement(Overlay, {
      image: { uri: 'https://example.com/image.png' },
      bounds: [
        [2, -179],
        [-2, 179],
      ],
      bearing: 30,
    }),
  ).json,
).sources.find((s) => s.data);
fixtures.push({
  label: 'rotated dateline Overlay footprint',
  data: overlayFootprint.data,
  positions: 5,
  generatedShape: true,
});
const batch = nativeShapes(
  compileMapContent(
    Array.from({ length: 200 }, (_, i) =>
      React.createElement(Polyline, {
        id: 'batch-' + i,
        coordinates: [
          { latitude: 0, longitude: 179 },
          { latitude: 1, longitude: -179 },
        ],
        strokeColor: i % 2 ? 'red' : 'blue',
      }),
    ),
  ),
  { sources: [], layers: [] },
).sources[0].data;
fixtures.push({
  label: '200 batched dateline lines',
  data: batch,
  positions: 400,
  generatedShape: true,
});
for (const [key, value] of [
  ['__shape_order', -1],
  ['__shape_order', 0.5],
  ['__shape_line_group', '0'],
  ['__shape_visible', 1],
  ['__shape_tappable', 'true'],
  ['__shape_width', 257],
  ['__shape_opacity', 2],
  ['__shape_fill', '#112233\n'],
  ['__shape_stroke', 'red'],
  ['unexpected', true],
]) {
  const data = structuredClone(batch);
  data.features[0].properties[key] = value;
  fixtures.push({
    label: 'invalid batch property ' + key + JSON.stringify(value),
    data,
    positions: null,
    generatedShape: true,
  });
}
const corpus = path.join(output, 'fixtures.json');
writeFileSync(corpus, JSON.stringify(fixtures));
// Preserve the same raw JSON tree in the JVM without a test-only JSON dependency.
// Tags: null, false, true, double, UTF-8 string, array, object; lengths are uint32 BE.
const chunks = [];
const tags = Array.from({ length: 7 }, (_, i) => Buffer.from([i]));
const integers = new Map(),
  strings = new Map();
const size = (value) => {
  if (!integers.has(value)) {
    const bytes = Buffer.alloc(4);
    bytes.writeUInt32BE(value);
    integers.set(value, bytes);
  }
  chunks.push(integers.get(value));
};
function encode(value) {
  if (value === null) chunks.push(tags[0]);
  else if (typeof value === 'boolean') chunks.push(tags[value ? 2 : 1]);
  else if (typeof value === 'number') {
    const bytes = Buffer.alloc(8);
    bytes.writeDoubleBE(value);
    chunks.push(tags[3], bytes);
  } else if (typeof value === 'string') {
    if (!strings.has(value)) strings.set(value, Buffer.from(value, 'utf8'));
    const bytes = strings.get(value);
    chunks.push(tags[4]);
    size(bytes.length);
    chunks.push(bytes);
  } else if (Array.isArray(value)) {
    chunks.push(tags[5]);
    size(value.length);
    for (const entry of value) encode(entry);
  } else {
    const entries = Object.entries(value);
    chunks.push(tags[6]);
    size(entries.length);
    for (const [key, entry] of entries) {
      encode(key);
      encode(entry);
    }
  }
}
encode(fixtures);
const binary = path.join(output, 'fixtures.bin');
writeFileSync(binary, Buffer.concat(chunks));

test('Android native GeoJSON validator enforces the shared transport corpus', () => {
  execFileSync('javac', [
    '-d',
    output,
    'packages/maps/android/src/main/java/com/enhancedmaps/GeoJSONValidation.java',
    'tests/native/GeoJSONValidationTest.java',
  ]);
  assert.doesNotThrow(() =>
    execFileSync('java', ['-cp', output, 'GeoJSONValidationTest', binary]),
  );
});
test(
  'iOS native GeoJSON validator enforces the same transport corpus',
  { skip: process.platform !== 'darwin' },
  () => {
    const executable = path.join(output, 'geojson-validation');
    execFileSync('clang', [
      '-fobjc-arc',
      '-framework',
      'Foundation',
      '-Ipackages/maps/ios',
      'tests/native/GeoJSONValidationTest.m',
      '-o',
      executable,
    ]);
    assert.doesNotThrow(() => execFileSync(executable, [corpus]));
  },
);
