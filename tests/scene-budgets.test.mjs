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
test('combined scene positions have no arbitrary count cap', async () => {
  const { compileScene, InternalSource } = await load();
  const source = (id, count) =>
    React.createElement(InternalSource, { id, data: points(count) });
  assert.doesNotThrow(() =>
    compileScene([source('a', 25000), source('b', 25000)]),
  );
  assert.doesNotThrow(() =>
    compileScene([source('a', 25000), source('b', 25001)]),
  );
});
test('layer references do not impose an arbitrary rendered-position cap', async () => {
  const { compileScene, InternalSource, InternalLayer } = await load();
  const scene = (count) =>
    React.createElement(
      InternalSource,
      { id: 'points', data: points(count) },
      ...Array.from({ length: 4 }, (_, i) =>
        React.createElement(InternalLayer, { id: `l${i}`, type: 'circle' }),
      ),
    );
  assert.doesNotThrow(() => compileScene(scene(25000)));
  assert.doesNotThrow(() => compileScene(scene(25001)));
});
test('combined scene payload is bounded in UTF-8 bytes rather than UTF-16 code units', async () => {
  const { compileScene, InternalSource } = await load();
  const data = points(1, { description: '水'.repeat(750000) });
  assert.doesNotThrow(() =>
    compileScene(React.createElement(InternalSource, { id: 'one', data })),
  );
  assert.throws(
    () =>
      compileScene([
        React.createElement(InternalSource, { id: 'one', data }),
        React.createElement(InternalSource, { id: 'two', data }),
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

test('all geometry kinds and generated shapes share the transport-size budget', async () => {
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
  // Many references remain valid when the serialized scene fits the byte budget.
  assert.doesNotThrow(() =>
    serializeMapScene(
      [sources.at(-1)],
      Array.from({ length: 25001 }, () => ({ source: '5' })),
    ),
  );
  const { compileScene, InternalSource } = await load();
  const { Circle } = await import('../packages/maps/lib/mapContent.js');
  assert.doesNotThrow(() =>
    compileScene([
      React.createElement(InternalSource, {
        id: 'points',
        data: points(49900),
      }),
      React.createElement(Circle, {
        id: 'circle',
        center: { latitude: 1, longitude: 1 },
        radius: 10,
      }),
    ]),
  );
});
