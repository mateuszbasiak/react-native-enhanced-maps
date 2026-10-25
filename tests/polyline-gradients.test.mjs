import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { readFileSync } from 'node:fs';
import {
  Polyline,
  Polygon,
  Circle,
  compileMapContent,
  reuseMapContent,
} from '../packages/maps/lib/mapContent.js';
import { nativeShapes } from '../packages/maps/lib/nativeShapes.js';
const empty = { sources: [], layers: [] };
const route = [
  { latitude: 0, longitude: 0 },
  { latitude: 0, longitude: 1 },
  { latitude: 0, longitude: 3 },
];
const colors = ['red', '#0f08', 'blue'];
const scene = (props, previous = empty) =>
  nativeShapes(
    compileMapContent(
      React.createElement(Polyline, {
        id: 'route',
        coordinates: route,
        ...props,
      }),
    ),
    previous,
  );
const stops = (value) => value.layers[0].style.lineGradient;
const near = (a, b) => assert(Math.abs(a - b) < 1e-10, `${a} != ${b}`);
const distance = (a, b) => {
  const y = (lat) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
  return Math.hypot(((b[0] - a[0]) * Math.PI) / 180, y(b[1]) - y(a[1]));
};

test('polyline gradients normalize per-vertex colors at Mercator distance stops', () => {
  const value = scene({ strokeColors: colors, strokeColor: 'black' });
  assert.equal(value.sources[0].lineMetrics, true);
  assert.deepEqual(stops(value), [
    [0, '#ff0000ff'],
    [1 / 3, '#00ff0088'],
    [1, '#0000ffff'],
  ]);
  const vertical = scene({
    coordinates: [
      { latitude: 0, longitude: 0 },
      { latitude: 60, longitude: 0 },
      { latitude: 80, longitude: 0 },
    ],
    strokeColors: colors,
  });
  near(
    stops(vertical)[1][0],
    distance([0, 0], [0, 60]) / distance([0, 0], [0, 80]),
  );
});

test('geodesic gradients retain color stops at original vertices after subdivision', () => {
  const coordinates = [
    { latitude: 10, longitude: -20 },
    { latitude: 40, longitude: 0 },
    { latitude: 30, longitude: 70 },
  ];
  const value = scene({ coordinates, geodesic: true, strokeColors: colors });
  const path = value.sources[0].data.features[0].geometry.coordinates;
  assert(path.length > coordinates.length);
  const middle = path.findIndex((p) => p[0] === 0 && p[1] === 40);
  assert(middle > 0);
  let total = 0,
    atMiddle = 0;
  for (let i = 1; i < path.length; i++) {
    total += distance(path[i - 1], path[i]);
    if (i === middle) atMiddle = total;
  }
  assert.equal(stops(value).length, 3);
  near(stops(value)[1][0], atMiddle / total);
});

test('coincident gradient vertices use the last color and zero-length paths stay finite', () => {
  const a = route[0],
    b = route[1];
  const duplicate = scene({
    coordinates: [a, a, b, b],
    strokeColors: ['red', 'yellow', 'green', 'blue'],
  });
  assert.deepEqual(stops(duplicate), [
    [0, '#ffff00ff'],
    [1, '#0000ffff'],
  ]);
  const zero = scene({ coordinates: [a, a, a], strokeColors: colors });
  assert.deepEqual(stops(zero), [
    [0, '#0000ffff'],
    [1, '#0000ffff'],
  ]);
});

test('gradient toggles revise source options while color updates preserve geometry and revision', () => {
  const solid = scene({});
  const gradient = scene({ strokeColors: colors }, solid);
  assert.equal(gradient.sources[0].revision, 1);
  assert.equal(gradient.sources[0].data, solid.sources[0].data);
  const recolored = scene({ strokeColors: ['blue', 'red', 'green'] }, gradient);
  assert.equal(recolored.sources, gradient.sources);
  assert.notDeepEqual(stops(recolored), stops(gradient));
  const removed = scene({}, recolored);
  assert.equal(removed.sources[0].revision, 2);
  assert.notEqual(removed.sources[0].lineMetrics, true);
  assert.equal(stops(removed), undefined);
});

test('immutable gradient compilation reuses scenes and recognizes gradient removal', () => {
  const compile = (props) =>
    compileMapContent(
      React.createElement(Polyline, {
        id: 'route',
        coordinates: route,
        ...props,
      }),
    );
  const first = compile({ strokeColors: colors });
  assert.equal(
    reuseMapContent(first, compile({ strokeColors: colors })),
    first,
  );
  const removed = reuseMapContent(first, compile({}));
  assert.notEqual(removed, first);
  assert.equal(stops(nativeShapes(removed, empty)), undefined);
  assert.deepEqual(colors, ['red', '#0f08', 'blue']);
  assert.deepEqual(
    route.map((p) => p.longitude),
    [0, 1, 3],
  );
});

test('invalid gradient colors/counts and dashed gradients reject before native transport', () => {
  for (const strokeColors of [
    [],
    ['red'],
    ['red', 'blue'],
    ['red', 'blue', 'green', 'red'],
    'red',
    [1, 2, 3],
    ['red', 'invalid', 'blue'],
    ['red', undefined, 'blue'],
    new Array(3),
  ])
    assert.throws(() => scene({ strokeColors }));
  assert.throws(
    () => scene({ strokeColors: colors, lineDashPattern: [8, 4] }),
    /gradient.*dash|dash.*gradient/i,
  );
  assert.equal(stops(scene({ lineDashPattern: [8, 4] })), undefined);
});

test('Polygon and Circle reject the Polyline-only gradient prop', () => {
  assert.throws(() =>
    compileMapContent(
      React.createElement(Polygon, {
        coordinates: [...route, { latitude: 1, longitude: 0 }],
        strokeColors: colors,
      }),
    ),
  );
  assert.throws(() =>
    compileMapContent(
      React.createElement(Circle, {
        center: route[0],
        radius: 100,
        strokeColors: colors,
      }),
    ),
  );
});

test('MapView scene transport preserves gradient source metrics and removes them for solid strokes', async () => {
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
  const compile = (props) =>
    JSON.parse(
      compileScene(
        React.createElement(Polyline, {
          id: 'route',
          coordinates: route,
          ...props,
        }),
      ).json,
    );
  const gradient = compile({ strokeColors: colors });
  assert.equal(gradient.sources[0].lineMetrics, true);
  assert.deepEqual(
    gradient.layers[0].style.lineGradient,
    stops(scene({ strokeColors: colors })),
  );
  const solid = compile({ strokeColor: 'orange' });
  assert.equal(solid.sources[0].lineMetrics, undefined);
  assert.equal(solid.layers[0].style.lineGradient, undefined);
});
