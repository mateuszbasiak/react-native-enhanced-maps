import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
const load = () => import('../packages/maps/lib/mapContent.js');
const line = [
  { latitude: 52, longitude: 21 },
  { latitude: 52.01, longitude: 21.01 },
];
test('standalone native shapes sort zIndex and preserve declaration-order ties', async () => {
  const { compileMapContent, Polyline, Polygon } = await load();
  const scene = compileMapContent([
    React.createElement(Polyline, {
      id: 'line',
      coordinates: line,
      zIndex: 20,
    }),
    React.createElement(Polygon, {
      id: 'area',
      coordinates: [...line, { latitude: 52, longitude: 21.01 }],
      zIndex: 0,
    }),
    React.createElement(Polyline, { id: 'tie', coordinates: line, zIndex: 20 }),
  ]);
  assert.deepEqual(
    scene.items.map((i) => i.id),
    ['area', 'line', 'tie'],
  );
  assert.equal(scene.items[0].coordinates.length, 4);
  assert.deepEqual(compileMapContent(null), { version: 1, items: [] });
});
test('invalid native component props fail before transport', async () => {
  const { compileMapContent, Polyline } = await load();
  for (const props of [
    { zIndex: NaN },
    { opacity: 2 },
    { strokeWidth: -1 },
    { coordinates: [{ latitude: 91, longitude: 0 }, line[1]] },
    { unsupported: 1 },
  ])
    assert.throws(() =>
      compileMapContent(
        React.createElement(Polyline, {
          id: 'line',
          coordinates: line,
          ...props,
        }),
      ),
    );
  assert.throws(
    () =>
      compileMapContent([
        React.createElement(Polyline, { id: 'line', coordinates: line }),
        React.createElement(Polyline, { id: 'line', coordinates: line }),
      ]),
    /Duplicate/,
  );
});
test('unchanged component data reuses the scene while style and order remain independently updateable', async () => {
  const { compileMapContent, reuseMapContent, Polyline } = await load();
  const make = (width, z = 0) =>
    compileMapContent(
      React.createElement(Polyline, {
        id: 'line',
        coordinates: line,
        strokeWidth: width,
        zIndex: z,
      }),
    );
  const first = make(4);
  assert.equal(reuseMapContent(first, make(4)), first);
  const styled = reuseMapContent(first, make(8));
  assert.notEqual(styled, first);
  assert.equal(styled.items[0].coordinates, first.items[0].coordinates);
  assert.notEqual(reuseMapContent(first, make(4, 10)), first);
});
test('SDK transport preserves source revisions on styles and updates geometry independently', async () => {
  const { compileMapContent, Polyline, Polygon } = await load();
  const { nativeShapes } = await import('../packages/maps/lib/nativeShapes.js');
  const empty = { sources: [], layers: [] };
  const first = nativeShapes(
    compileMapContent(
      React.createElement(Polyline, { id: 'line', coordinates: line }),
    ),
    empty,
  );
  const styled = nativeShapes(
    compileMapContent(
      React.createElement(Polyline, {
        id: 'line',
        coordinates: line,
        strokeWidth: 8,
        zIndex: 20,
      }),
    ),
    first,
  );
  assert.equal(styled.sources, first.sources);
  assert.equal(styled.sources[0].revision, 0);
  assert.equal(styled.sources[0].data, first.sources[0].data);
  const changed = nativeShapes(
    compileMapContent(
      React.createElement(Polyline, {
        id: 'line',
        coordinates: [...line, { latitude: 52.02, longitude: 21 }],
      }),
    ),
    styled,
  );
  assert.equal(changed.sources[0].revision, 1);
  const polygon = nativeShapes(
    compileMapContent(
      React.createElement(Polygon, {
        id: 'area',
        coordinates: [...line, { latitude: 52, longitude: 21.01 }],
        opacity: 0.5,
      }),
    ),
    empty,
  );
  assert.deepEqual(
    polygon.layers.map((l) => l.type),
    ['fill', 'line'],
  );
  assert.equal(polygon.layers[0].style.fillOpacity, 0.5);
  assert.deepEqual(nativeShapes(compileMapContent(null), polygon), empty);
});
test('maximum public IDs produce bounded native identifiers', async () => {
  const { compileMapContent, Polyline } = await load();
  const { nativeShapes } = await import('../packages/maps/lib/nativeShapes.js');
  const id = 'a'.repeat(128);
  const scene = nativeShapes(
    compileMapContent(React.createElement(Polyline, { id, coordinates: line })),
    { sources: [], layers: [] },
  );
  assert.equal(scene.sources[0].id, id);
  assert.ok(scene.layers.every((layer) => layer.id.length <= 128));
});
test('Circle produces a closed geographic ring at the requested meter radius', async () => {
  const { Circle, compileMapContent } = await load();
  assert.equal(typeof Circle, 'function');
  const scene = compileMapContent(
    React.createElement(Circle, {
      center: { latitude: 0, longitude: 179.999 },
      radius: 1000,
    }),
  );
  const points = scene.items[0].coordinates;
  assert.equal(points.length, 129);
  assert.deepEqual(points[0], points.at(-1));
  for (const p of points) {
    const r = Math.PI / 180;
    const a =
      Math.sin((p.latitude * r) / 2) ** 2 +
      Math.cos(p.latitude * r) *
        Math.sin(((p.longitude - 179.999) * r) / 2) ** 2;
    assert.ok(
      Math.abs(
        6371008.8 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) - 1000,
      ) < 0.001,
    );
  }
  for (const radius of [-1, NaN, Infinity, 1000001])
    assert.throws(() =>
      compileMapContent(
        React.createElement(Circle, {
          center: { latitude: 0, longitude: 0 },
          radius,
        }),
      ),
    );
  assert.throws(
    () =>
      compileMapContent(
        React.createElement(Circle, {
          center: { latitude: 85, longitude: 0 },
          radius: 1000,
        }),
      ),
    /latitude/,
  );
});
test('shape styles preserve caps, joins, miter limits and point-based dashes in native transport', async () => {
  const { compileMapContent, Polyline } = await load();
  const { nativeShapes } = await import('../packages/maps/lib/nativeShapes.js');
  const scene = nativeShapes(
    compileMapContent(
      React.createElement(Polyline, {
        coordinates: line,
        strokeWidth: 4,
        lineCap: 'square',
        lineJoin: 'bevel',
        miterLimit: 5,
        lineDashPattern: [8, 4],
      }),
    ),
    { sources: [], layers: [] },
  );
  assert.deepEqual(scene.layers[0].style.lineDasharray, [2, 1]);
  assert.equal(scene.layers[0].style.lineCap, 'square');
  assert.equal(scene.layers[0].style.lineJoin, 'bevel');
  assert.equal(scene.layers[0].style.lineMiterLimit, 5);
  for (const props of [
    { lineCap: 'invalid' },
    { lineJoin: 'invalid' },
    { lineDashPattern: [0, 0] },
    { lineDashPattern: [-1, 2] },
    { miterLimit: NaN },
  ])
    assert.throws(() =>
      compileMapContent(
        React.createElement(Polyline, { coordinates: line, ...props }),
      ),
    );
});
test('shape press callbacks remain out of JSON and only tappable shapes register handlers', async () => {
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
  const { compileScene } = await import(
    `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`
  );
  const { Polyline } = await load();
  const received = [];
  const onPress = (e) => received.push(e);
  const scene = compileScene([
    React.createElement(Polyline, {
      id: 'active',
      coordinates: line,
      tappable: true,
      onPress,
    }),
    React.createElement(Polyline, {
      id: 'passive',
      coordinates: line,
      onPress,
    }),
  ]);
  assert.equal(scene.presses.has('passive'), false);
  assert.equal(scene.presses.has('active'), true);
  const event = {
    coordinate: { latitude: 52, longitude: 21 },
    position: { x: 12, y: 34 },
  };
  scene.presses.get('active')('geometry', event);
  assert.deepEqual(received, [
    { nativeEvent: { ...event, identifier: 'active' } },
  ]);
  const json = JSON.parse(scene.json);
  assert.equal(json.layers[0].interactive, true);
  assert.equal(json.layers[1].interactive, false);
});
test('zero-radius circles have no rendered geometry even with a visible stroke', async () => {
  const { compileMapContent, Circle } = await load();
  const { nativeShapes } = await import('../packages/maps/lib/nativeShapes.js');
  const scene = nativeShapes(
    compileMapContent(
      React.createElement(Circle, {
        center: { latitude: 52, longitude: 21 },
        radius: 0,
        strokeWidth: 20,
      }),
    ),
    { sources: [], layers: [] },
  );
  assert.deepEqual(scene.sources[0].data.features, []);
});
