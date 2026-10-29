import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
const load = async (module) => {
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
};
const { compileScene } = await load('maplibreContent');
const { UrlTile, normalizeUrlTile } =
  await import('../packages/maps/lib/UrlTile.js');
const { Circle } = await import('../packages/maps/lib/mapContent.js');
const template = 'https://tiles.example.test/{z}/{x}/{y}.png?token=app';
const tile = (props = {}) =>
  React.createElement(UrlTile, { urlTemplate: template, ...props });
const scene = (children) => JSON.parse(compileScene(children).json);

test('UrlTile compiles bounded raster resources without GeoJSON or a live React host', () => {
  const compiled = compileScene(tile());
  const { sources, layers } = JSON.parse(compiled.json);
  assert.equal(compiled.live.length, 0);
  assert.deepEqual(sources, [
    {
      id: 'url-tile:0',
      type: 'raster',
      urlTemplate: template,
      tileSize: 256,
      minZoom: 0,
      maxZoom: 22,
    },
  ]);
  assert.deepEqual(layers, [
    {
      id: 'raster:url-tile:0',
      source: 'url-tile:0',
      type: 'raster',
      visible: true,
      interactive: false,
      style: { rasterOpacity: 1 },
    },
  ]);
  assert.equal(compiled.presses.size, 0);
});

test('tiles and shapes share zIndex and declaration-order ties through Fragments', () => {
  const shape = React.createElement(Circle, {
    id: 'shape',
    center: { latitude: 0, longitude: 0 },
    radius: 10,
    zIndex: 2,
  });
  const value = scene(
    React.createElement(
      React.Fragment,
      null,
      tile({ id: 'first', zIndex: 2 }),
      shape,
      tile({ id: 'below', zIndex: -2 }),
      tile({ id: 'last', zIndex: 2, opacity: 0.4, visible: false }),
    ),
  );
  assert.deepEqual(
    value.layers.map((l) => l.source),
    ['below', 'first', 'shape', 'shape', 'last'],
  );
  assert.equal(value.layers.at(-1).visible, false);
  assert.equal(value.layers.at(-1).style.rasterOpacity, 0.4);
  assert.equal(scene([tile(), tile()]).sources.length, 2);
});

test('UrlTile rejects malformed templates, out-of-range options and ambiguous resources', () => {
  for (const urlTemplate of [
    '',
    'file:///a/{z}/{x}/{y}',
    'https://a/{z}/{x}',
    'https://a/{z}/{x}/{y}/{q}',
    'https://a/{z}/{x}/{y}\n',
    'https:///{z}/{x}/{y}',
    'https://a/' + 'x'.repeat(4096) + '/{z}/{x}/{y}',
  ])
    assert.throws(() => normalizeUrlTile({ urlTemplate }));
  for (const props of [
    { tileSize: 0 },
    { tileSize: 300 },
    { tileSize: 2048 },
    { minimumZ: -1 },
    { minimumZ: 1.5 },
    { maximumZ: 23 },
    { minimumZ: 10, maximumZ: 9 },
    { opacity: NaN },
    { opacity: 2 },
    { visible: 'yes' },
    { zIndex: Infinity },
  ])
    assert.throws(() => scene(tile(props)));
  assert.throws(
    () => scene([tile({ id: 'same' }), tile({ id: 'same' })]),
    /Duplicate source/,
  );
  assert.doesNotThrow(() =>
    scene(Array.from({ length: 65 }, (_, i) => tile({ id: 't' + i }))),
  );
  assert.deepEqual(
    normalizeUrlTile({
      urlTemplate: template,
      tileSize: 512,
      minimumZ: 2,
      maximumZ: 16,
    }).tileSize,
    512,
  );
});

test('XYZ placeholders must be transmitted to the tile server, not placed in a fragment', () => {
  assert.throws(() =>
    normalizeUrlTile({
      urlTemplate: 'https://example.test/static.png#{z}/{x}/{y}',
    }),
  );
});

test('a raster ID resembling marker infrastructure remains a valid non-clustered source', () => {
  const value = scene(tile({ id: 'em-marker-clusters:tiles' }));
  assert.equal(value.sources[0].type, 'raster');
  assert.equal(value.sources[0].revision, undefined);
  assert.equal(value.layers[0].interactive, false);
});

test('unsupported tile modes fail explicitly for JavaScript migration callers', () => {
  for (const props of [
    { shouldReplaceMapContent: true },
    { maximumNativeZ: 18 },
    { children: 'unsupported' },
  ])
    assert.throws(() => scene(tile(props)), /Unsupported UrlTile prop/);
});

test('UrlTile flipY uses native TMS addressing and rejects non-booleans', () => {
  assert.equal(scene(tile({ flipY: true })).sources[0].scheme, 'tms');
  assert.equal(scene(tile({ flipY: false })).sources[0].scheme, undefined);
  for (const flipY of [null, 1, 'true'])
    assert.throws(
      () => normalizeUrlTile({ urlTemplate: template, flipY }),
      /boolean/,
    );
});
