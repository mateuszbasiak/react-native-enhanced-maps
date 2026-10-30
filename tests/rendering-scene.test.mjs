import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import React from 'react';
import { Overlay } from '../packages/maps/lib/imageOverlay.js';
import { Heatmap } from '../packages/maps/lib/heatmap.js';
import { WMSTile, LocalTile } from '../packages/maps/lib/rnTiles.js';
import { Polygon } from '../packages/maps/lib/mapContent.js';
const url = new URL('../packages/maps/lib/maplibreContent.js', import.meta.url);
const code = readFileSync(url, 'utf8')
  .replace("from 'react'", `from '${import.meta.resolve('react')}'`)
  .replace(
    /from '(\.\/[^']+)'/g,
    (_, path) => `from '${new URL(path + '.js', url).href}'`,
  );
const { compileScene } = await import(
  `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`
);
const bounds = [
  [2, 3],
  [0, 1],
];
test('Overlay native image and hit layers preserve declaration order with shapes and original events', () => {
  const received = [];
  const scene = compileScene(
    [
      React.createElement(Polygon, {
        key: 'shape',
        id: 'shape',
        coordinates: [
          { latitude: 0, longitude: 0 },
          { latitude: 1, longitude: 0 },
          { latitude: 1, longitude: 1 },
        ],
      }),
      React.createElement(Overlay, {
        key: 'image',
        image: 42,
        bounds,
        tappable: true,
        onPress: (e) => received.push(e),
      }),
    ],
    () => ({ uri: 'https://example.com/image.png' }),
  );
  const native = JSON.parse(scene.json);
  assert.deepEqual(
    native.layers.map((l) => l.type),
    ['fill', 'line', 'raster', 'fill'],
  );
  assert.equal(native.sources.filter((s) => s.tileKind === 'image').length, 1);
  assert.equal(scene.live.length, 0);
  const hit = native.layers.at(-1);
  assert.equal(hit.interactive, true);
  scene.presses.get(hit.source)('image', {
    coordinate: { latitude: 1, longitude: 2 },
    position: { x: 10, y: 20 },
  });
  assert.deepEqual(received[0].nativeEvent, {
    action: 'overlay-press',
    coordinate: { latitude: 1, longitude: 2 },
    position: { x: 10, y: 20 },
  });
  for (const props of [{ opacity: 0 }, { tappable: false }]) {
    const hidden = compileScene(
      React.createElement(Overlay, {
        image: { uri: 'https://example.com/image.png' },
        bounds,
        tappable: true,
        onPress: () => {},
        ...props,
      }),
    );
    assert.equal(hidden.presses.size, 0);
  }
  assert.deepEqual(JSON.parse(compileScene(null).json), {
    sources: [],
    layers: [],
  });
});
test('Heatmap, WMS and local tiles share a scene without becoming live React hosts', () => {
  const scene = compileScene([
    React.createElement(Heatmap, { key: 'h', points: [] }),
    React.createElement(WMSTile, {
      key: 'w',
      urlTemplate: 'https://example.com/wms?bbox={minX},{minY},{maxX},{maxY}',
    }),
    React.createElement(LocalTile, {
      key: 'l',
      pathTemplate: '/app/tiles/{z}/{x}/{y}.png',
    }),
  ]);
  const native = JSON.parse(scene.json);
  assert.deepEqual(
    native.layers.map((l) => l.type),
    ['heatmap', 'raster', 'raster'],
  );
  assert.deepEqual(
    native.sources.filter((s) => s.type === 'raster').map((s) => s.tileKind),
    ['wms', 'local'],
  );
  assert.equal(scene.live.length, 0);
  assert.doesNotThrow(() =>
    compileScene(
      Array.from({ length: 9 }, (_, i) =>
        React.createElement(Overlay, {
          key: i,
          bounds,
          image: { uri: 'https://example.com/image.png' },
        }),
      ),
    ),
  );
});

test('Overlay fitting footprint is independent of tappability, handlers and opacity', () => {
  const footprints = [
    {},
    { tappable: true, onPress: () => {} },
    { opacity: 0 },
  ].map((props) =>
    JSON.parse(
      compileScene(
        React.createElement(Overlay, {
          image: { uri: 'https://example.com/image.png' },
          bounds,
          ...props,
        }),
      ).json,
    )
      .sources.filter((s) => s.data)
      .map((s) => s.data),
  );
  assert.equal(footprints[0].length, 1);
  assert.deepEqual(footprints[0], footprints[1]);
  assert.deepEqual(footprints[0], footprints[2]);
});

test('Overlay footprints can coexist with more than 10000 shape positions', async () => {
  const { Polyline } = await import('../packages/maps/lib/mapContent.js');
  assert.doesNotThrow(() =>
    compileScene([
      React.createElement(Polyline, {
        key: 'line',
        coordinates: Array.from({ length: 10000 }, (_, i) => ({
          latitude: 0,
          longitude: i % 2,
        })),
      }),
      React.createElement(Overlay, {
        key: 'overlay',
        image: { uri: 'https://example.com/image.png' },
        bounds,
      }),
    ]),
  );
});
