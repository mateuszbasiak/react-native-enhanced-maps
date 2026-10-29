import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import {
  Polyline,
  Polygon,
  Circle,
  compileMapContent,
} from '../packages/maps/lib/mapContent.js';
import { nativeShapes } from '../packages/maps/lib/nativeShapes.js';
const url = new URL('../packages/maps/lib/maplibreContent.js', import.meta.url);
const code = readFileSync(url, 'utf8')
  .replace("from 'react'", `from '${import.meta.resolve('react')}'`)
  .replace(
    /from '(\.\/[^']+)'/g,
    (_, path) => `from '${new URL(path + '.js', url).href}'`,
  );
const { compileScene, InternalSource, InternalLayer } = await import(
  `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`
);
const coordinates = [
  { latitude: 0, longitude: 0 },
  { latitude: 1, longitude: 1 },
];
const line = (id, props = {}) =>
  React.createElement(Polyline, { id, coordinates, ...props });
const compile = (children, previous = { sources: [], layers: [] }) =>
  nativeShapes(compileMapContent(children), previous);
const polygon = (id, props = {}) =>
  React.createElement(Polygon, {
    id,
    coordinates: [...coordinates, { latitude: 0, longitude: 1 }],
    ...props,
  });
test('200 differently painted polygons share one source and two layers', () => {
  const result = compile(
    Array.from({ length: 200 }, (_, i) =>
      polygon('p' + i, {
        fillColor: i % 2 ? 'red' : 'blue',
        strokeWidth: i % 4,
      }),
    ),
  );
  assert.equal(result.sources.length, 1);
  assert.deepEqual(
    result.layers.map((l) => l.type),
    ['fill', 'line'],
  );
  assert.equal(result.sources[0].data.features.length, 200);
});
test('nonconsecutive paint styles and mixed shape types batch with explicit feature order', () => {
  const shapes = [
    line('a', { strokeColor: 'red' }),
    polygon('p'),
    line('b', { strokeColor: 'blue' }),
    React.createElement(Circle, { id: 'c', center: coordinates[0], radius: 1 }),
  ];
  const result = compile(shapes);
  assert.equal(result.sources.length, 1);
  assert.equal(result.layers.length, 2);
  assert.deepEqual(
    result.sources[0].data.features.map((f) => f.id),
    ['a', 'p', 'b', 'c'],
  );
  assert.deepEqual(
    result.sources[0].data.features.map((f) => f.properties.__shape_order),
    [0, 1, 2, 3],
  );
  assert.equal(result.layers[0].shapeGroup, 0);
  const lines = [line('a'), line('b')];
  const before = compile(lines);
  assert.equal(compile(lines, before).sources, before.sources);
});
test('layout and gradient runs preserve outline order, and zIndex remains a boundary', () => {
  const result = compile([
    line('a'),
    line('b', { lineCap: 'square' }),
    line('c'),
    line('d', { zIndex: 1 }),
  ]);
  assert.equal(result.sources.length, 2);
  assert.equal(result.layers.length, 4);
  assert.deepEqual(
    result.layers.slice(0, 3).map((l) => l.style.lineCap),
    ['round', 'square', 'round'],
  );
});
test('batched presses dispatch by feature ID and keep passive features noninteractive', () => {
  const calls = [];
  const scene = compileScene([
    line('a', {
      tappable: true,
      onPress: (e) => calls.push(e.nativeEvent.identifier),
    }),
    line('passive'),
    line('b', {
      tappable: true,
      onPress: (e) => calls.push(e.nativeEvent.identifier),
    }),
  ]);
  const data = JSON.parse(scene.json);
  assert.equal(data.sources.length, 1);
  assert.deepEqual(
    data.sources[0].data.features.map((f) => f.properties.__shape_tappable),
    [true, false, true],
  );
  scene.presses.get(data.sources[0].id)('b', {
    coordinate: coordinates[0],
    position: { x: 1, y: 2 },
  });
  assert.deepEqual(calls, ['b']);
});
test('old component, position and native-resource counts do not reject valid scenes', () => {
  assert.doesNotThrow(() =>
    compileScene(
      Array.from({ length: 130 }, (_, i) => line('s' + i, { zIndex: i })),
    ),
  );
  assert.doesNotThrow(() =>
    compileScene(
      line('long', {
        coordinates: Array.from({ length: 50001 }, () => coordinates[0]),
      }),
    ),
  );
  assert.doesNotThrow(() =>
    compileScene(
      Array.from({ length: 130 }, (_, i) =>
        React.createElement(
          InternalSource,
          { id: 's' + i, data: { type: 'FeatureCollection', features: [] } },
          React.createElement(InternalLayer, { id: 'l' + i, type: 'line' }),
        ),
      ),
    ),
  );
});
test('hidden features retain fitting geometry and source revisions change with batch paint', () => {
  const before = compile([line('a'), line('b', { visible: false })]);
  assert.equal(
    before.sources[0].data.features[1].properties.__shape_visible,
    false,
  );
  assert.equal(
    before.sources[0].data.features[1].geometry.coordinates.length,
    2,
  );
  const next = compile(
    [line('a', { strokeColor: 'red' }), line('b', { visible: false })],
    before,
  );
  assert.equal(next.sources[0].revision, before.sources[0].revision + 1);
});
test('equal gradient lines share a metrics source and a layer, incompatible gradients retain ordered runs', () => {
  const gradient = { strokeColors: ['red', 'blue'] };
  const shared = compile([line('a', gradient), line('b', gradient)]);
  assert.equal(shared.sources.length, 1);
  assert.equal(shared.sources[0].lineMetrics, true);
  assert.equal(shared.layers.length, 1);
  const mixed = compile([line('a', gradient), line('b'), line('c', gradient)]);
  assert.equal(mixed.layers.length, 3);
});

test('batching cannot hide collisions with authored source IDs or steal their callbacks', () => {
  assert.throws(
    () =>
      compileScene([
        React.createElement(InternalSource, {
          id: 'b',
          onPress: () => {},
          data: { type: 'FeatureCollection', features: [] },
        }),
        line('a'),
        line('b'),
      ]),
    /Duplicate source id/,
  );
});
