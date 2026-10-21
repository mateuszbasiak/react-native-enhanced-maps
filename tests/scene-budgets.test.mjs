import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
const load = async () => {
  const url = new URL(
    '../packages/maps/lib/maplibreContent.js',
    import.meta.url,
  );
  const code = readFileSync(url, 'utf8')
    .replace("from 'react'", `from '${import.meta.resolve('react')}'`)
    .replace(
      /from '(\.\/[^']+)'/g,
      (_, path) => `from '${new URL(path + '.js', url).href}'`,
    );
  return import(
    `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`
  );
};
const points = (count, properties = null) => ({
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      id: 'points',
      properties,
      geometry: {
        type: 'MultiPoint',
        coordinates: Array.from({ length: count }, () => [1, 1]),
      },
    },
  ],
});
test('combined scene positions cannot bypass independently valid source limits', async () => {
  const { compileScene, GeoJSONSource } = await load();
  const source = (id, count) =>
    React.createElement(GeoJSONSource, { id, data: points(count) });
  assert.doesNotThrow(() =>
    compileScene([source('a', 25000), source('b', 25000)]),
  );
  assert.throws(
    () => compileScene([source('a', 25000), source('b', 25001)]),
    /position limit/i,
  );
});
test('referencing one source many times remains bounded by rendered positions', async () => {
  const { compileScene, GeoJSONSource, Layer } = await load();
  const scene = (count) =>
    React.createElement(
      GeoJSONSource,
      { id: 'points', data: points(count) },
      ...Array.from({ length: 4 }, (_, i) =>
        React.createElement(Layer, { id: `l${i}`, type: 'circle' }),
      ),
    );
  assert.doesNotThrow(() => compileScene(scene(25000)));
  assert.throws(() => compileScene(scene(25001)), /rendered.*position limit/i);
});
test('combined scene payload is bounded in UTF-8 bytes rather than UTF-16 code units', async () => {
  const { compileScene, GeoJSONSource } = await load();
  const data = points(1, { description: '水'.repeat(750000) });
  assert.doesNotThrow(() =>
    compileScene(React.createElement(GeoJSONSource, { id: 'one', data })),
  );
  assert.throws(
    () =>
      compileScene([
        React.createElement(GeoJSONSource, { id: 'one', data }),
        React.createElement(GeoJSONSource, { id: 'two', data }),
      ]),
    /4 MiB|byte limit/i,
  );
});

test('scene UTF-8 accounting matches encoded bytes for every Unicode width', async () => {
  const { utf8ByteLength } =
    await import('../packages/maps/lib/sceneBudget.js');
  for (const value of [
    '',
    'ASCII',
    '\u007f\u0080\u07ff\u0800',
    '水',
    '😀',
    '\ud800',
    '\udc00',
    '\ud800A',
    'a😀水z',
  ])
    assert.equal(utf8ByteLength(value), Buffer.byteLength(value, 'utf8'));
});

test('scene counts include all geometry kinds and generated shapes', async () => {
  const { serializeMapScene } =
    await import('../packages/maps/lib/sceneBudget.js');
  const geometry = (type, coordinates) => ({
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        id: 'f',
        properties: null,
        geometry: { type, coordinates },
      },
    ],
  });
  const p = [1, 1];
  const sources = [
    ['Point', p],
    ['MultiPoint', [p, p]],
    ['LineString', [p, p]],
    [
      'MultiLineString',
      [
        [p, p],
        [p, p],
      ],
    ],
    ['Polygon', [[p, p, p, p]]],
    ['MultiPolygon', [[[p, p, p, p]]]],
  ].map(([type, coordinates], i) => ({
    id: String(i),
    data: geometry(type, coordinates),
  }));
  assert.doesNotThrow(() => serializeMapScene(sources, []));
  // Count MultiPolygon's four positions for every reference, rather than its array depth.
  assert.throws(
    () =>
      serializeMapScene(
        [sources.at(-1)],
        Array.from({ length: 25001 }, () => ({ source: '5' })),
      ),
    /rendered.*position limit/i,
  );
  const { compileScene, GeoJSONSource } = await load();
  const { Circle } = await import('../packages/maps/lib/mapContent.js');
  assert.throws(
    () =>
      compileScene([
        React.createElement(GeoJSONSource, {
          id: 'points',
          data: points(49900),
        }),
        React.createElement(Circle, {
          id: 'circle',
          center: { latitude: 1, longitude: 1 },
          radius: 10,
        }),
      ]),
    /position limit/i,
  );
});
