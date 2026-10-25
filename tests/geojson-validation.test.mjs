import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { compileLayers, GeoJSONSource } from '../packages/maps/lib/layers.js';

const outer = [
  [170, -10],
  [-170, -10],
  [-170, 10],
  [170, 10],
  [170, -10],
];
const hole = [
  [175, -2],
  [175, 2],
  [-175, 2],
  [-175, -2],
  [175, -2],
];
const geometries = [
  { type: 'Point', coordinates: [180, 90] },
  {
    type: 'MultiPoint',
    coordinates: [
      [-180, -90],
      [180, 90],
    ],
  },
  {
    type: 'LineString',
    coordinates: [
      [179, 0],
      [-179, 0],
    ],
  },
  {
    type: 'MultiLineString',
    coordinates: [
      [
        [179, 0],
        [-179, 0],
      ],
      [
        [0, -90],
        [0, 90],
      ],
    ],
  },
  { type: 'Polygon', coordinates: [outer, hole] },
  { type: 'MultiPolygon', coordinates: [[outer, hole], [outer.toReversed()]] },
];
function compile(geometry) {
  return compileLayers(
    React.createElement(GeoJSONSource, {
      id: 'fixture',
      revision: 1,
      data: {
        type: 'FeatureCollection',
        features: [
          { type: 'Feature', id: 'feature', properties: null, geometry },
        ],
      },
    }),
  );
}
function at(value, path) {
  return path.reduce((current, index) => current[index], value);
}
const positionPaths = [[], [0], [0], [0, 0], [0, 1], [0, 0, 1]];

for (const [index, fixture] of geometries.entries()) {
  test(`${fixture.type} preserves accepted dateline/polar coordinates and ring ordering`, () => {
    const input = structuredClone(fixture);
    const before = structuredClone(input);
    const result = compile(input);
    assert.deepEqual(result.sources[0].data.features[0].geometry, before);
    assert.deepEqual(
      JSON.parse(JSON.stringify(result.sources[0].data)).features[0].geometry,
      before,
    );
    assert.deepEqual(input, before, 'validation must not rewrite input');
  });

  for (const [label, axis, value] of [
    ['NaN', 0, NaN],
    ['infinity', 1, Infinity],
    ['negative infinity', 0, -Infinity],
    ['longitude outside range', 0, 180.01],
    ['latitude outside range', 1, -90.01],
    ['null axis', 0, null],
    ['string axis', 1, '0'],
    ['undefined axis', 0, undefined],
  ]) {
    test(`${fixture.type} rejects ${label} before serialization`, () => {
      const input = structuredClone(fixture);
      at(input.coordinates, positionPaths[index])[axis] = value;
      assert.throws(() => compile(input), /GeoJSON position/);
    });
  }

  for (const [label, length] of [
    ['short', 1],
    ['extra-dimensional', 3],
  ]) {
    test(`${fixture.type} rejects a ${label} coordinate tuple`, () => {
      const input = structuredClone(fixture);
      const position = at(input.coordinates, positionPaths[index]);
      position.length = length;
      if (length === 3) position[2] = 100;
      assert.throws(() => compile(input), /GeoJSON position/);
    });
  }

  for (const axis of [0, 1]) {
    test(`${fixture.type} rejects a missing tuple axis ${axis}`, () => {
      const input = structuredClone(fixture);
      delete at(input.coordinates, positionPaths[index])[axis];
      assert.throws(() => compile(input), /GeoJSON position/);
    });
  }
}

for (const [label, index, path, missing] of [
  ['MultiPoint position', 1, [], 0],
  ['LineString position', 2, [], 0],
  ['MultiLineString line', 3, [], 0],
  ['MultiLineString position', 3, [0], 0],
  ['Polygon exterior', 4, [], 0],
  ['Polygon hole', 4, [], 1],
  ['Polygon ring position', 4, [0], 1],
  ['MultiPolygon polygon', 5, [], 0],
  ['MultiPolygon exterior', 5, [0], 0],
  ['MultiPolygon hole', 5, [0], 1],
  ['MultiPolygon ring position', 5, [0, 0], 1],
]) {
  test(`rejects sparse ${label}`, () => {
    const input = structuredClone(geometries[index]);
    delete at(input.coordinates, path)[missing];
    assert.throws(() => compile(input), /GeoJSON/);
  });
}

for (const type of ['Polygon', 'MultiPolygon']) {
  test(`${type} rejects an open interior ring`, () => {
    const coordinates = structuredClone([outer, hole]);
    coordinates[1].at(-1)[0] += 1;
    assert.throws(
      () =>
        compile({
          type,
          coordinates: type === 'Polygon' ? coordinates : [coordinates],
        }),
      /rings must be closed/,
    );
  });
}
