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
test('combined scene payload accepts more than 4 MiB of UTF-8 JSON', async () => {
  const { compileScene, InternalSource } = await load();
  const data = points(1, { description: '水'.repeat(750000) });
  assert.doesNotThrow(() =>
    compileScene(React.createElement(InternalSource, { id: 'one', data })),
  );
  assert.doesNotThrow(() =>
    compileScene([
      React.createElement(InternalSource, { id: 'one', data }),
      React.createElement(InternalSource, { id: 'two', data }),
    ]),
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

test('all geometry kinds and generated shapes serialize without dataset caps', async () => {
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
  // Layer references have no fixed dataset-count cap.
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

test('individual GeoJSON sources and map content have no serialized-size cap', async () => {
  const { compileScene, InternalSource } = await load();
  const data = points(700001);
  const scene = compileScene(
    React.createElement(InternalSource, { id: 'large', data }),
  );
  assert(Buffer.byteLength(scene.json) > 4 * 1024 * 1024);
  const { serializeMapContent } =
    await import('../packages/maps/lib/mapContent.js');
  const content = {
    version: 1,
    items: Array.from({ length: 100000 }, () => ({ id: 'large-content' })),
  };
  assert(serializeMapContent(content).length > 2 * 1024 * 1024);
});

test('large heatmap scenes retain per-feature property complexity checks', async () => {
  const { compileScene } = await load();
  const { Heatmap } = await import('../packages/maps/lib/heatmap.js');
  const points = Array.from({ length: 30000 }, () => ({
    latitude: 0,
    longitude: 0,
  }));
  const scene = compileScene(React.createElement(Heatmap, { points }));
  assert.equal(
    JSON.parse(scene.json).sources[0].data.features.length,
    points.length,
  );
  assert.throws(
    () =>
      compileScene(
        React.createElement(Heatmap, {
          points: Array(50001).fill({ latitude: 0, longitude: 0 }),
        }),
      ),
    /generated GeoJSON byte limit/,
  );
});

test('large incompatible stroke runs avoid JavaScript argument-count limits', async () => {
  const { compileScene } = await load();
  const { Polyline } = await import('../packages/maps/lib/mapContent.js');
  const coordinates = [
    { latitude: 0, longitude: 0 },
    { latitude: 1, longitude: 1 },
  ];
  const children = Array.from({ length: 130000 }, (_, i) =>
    React.createElement(Polyline, {
      id: 'line' + i,
      coordinates,
      lineCap: i % 2 ? 'butt' : 'round',
    }),
  );
  const scene = compileScene(children);
  assert.equal(JSON.parse(scene.json).layers.length, children.length);
});
