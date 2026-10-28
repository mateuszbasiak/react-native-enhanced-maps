import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import * as geo from '../packages/maps/lib/geojson.js';
import { collectMarkers } from '../packages/maps/lib/markerClustering.js';
import { compileMapContent } from '../packages/maps/lib/mapContent.js';
const Marker = () => null;
const feature = (type, coordinates, properties = {}) => ({
  type: 'Feature',
  properties,
  geometry: { type, coordinates },
});
const data = (...features) => ({ type: 'FeatureCollection', features });
test('Geojson expands multi-geometries, holes and upstream press descriptions', () => {
  assert.equal(typeof geo.expandGeojson, 'function');
  const polygon = feature('Polygon', [
    [
      [0, 0],
      [2, 0],
      [2, 2],
      [0, 0],
    ],
    [
      [0.5, 0.5],
      [1, 0.5],
      [1, 1],
      [0.5, 0.5],
    ],
  ]);
  const point = feature(
    'MultiPoint',
    [
      [0, 0],
      [1, 1],
    ],
    { 'marker-color': 'red' },
  );
  const presses = [];
  const children = geo.expandGeojson(
    {
      geojson: data(point, polygon),
      onPress: (e) => presses.push(e),
      tappable: true,
    },
    Marker,
    'test',
  );
  assert.equal(children.length, 3);
  assert.equal(children[0].type, Marker);
  assert.equal(children[0].props.pinColor, 'red');
  children[1].props.onPress({ nativeEvent: {} });
  assert.deepEqual(presses[0], {
    type: 'point',
    feature: point,
    coordinates: { latitude: 1, longitude: 1 },
  });
  const scene = compileMapContent(children.slice(2));
  assert.equal(scene.items[0].holes.length, 1);
  children[2].props.onPress({ nativeEvent: {} });
  assert.equal(presses[1].feature, polygon);
  assert.equal(presses[1].type, 'polygon');
});
test('Geojson style properties override props, including zero opacity/width', () => {
  const f = feature(
    'LineString',
    [
      [0, 0],
      [1, 1],
    ],
    { stroke: '#ff0000', 'stroke-opacity': 0, 'stroke-width': 0 },
  );
  const nodes = geo.expandGeojson(
    { geojson: data(f), strokeColor: 'blue', strokeWidth: 5 },
    Marker,
    'test',
  );
  const item = compileMapContent(nodes).items[0];
  assert.equal(item.strokeWidth, 0);
  assert.equal(item.strokeColor, '#ff000000');
});
test('Geojson is expanded before marker collection, retaining siblings and unique map-scoped identities', () => {
  const props = {
    geojson: data(
      feature('Point', [0, 0]),
      feature('LineString', [
        [0, 0],
        [1, 1],
      ]),
    ),
  };
  const result = collectMarkers(
    [
      React.createElement(geo.Geojson, { ...props, key: 'a' }),
      React.createElement(geo.Geojson, { ...props, key: 'b' }),
    ],
    Marker,
  );
  assert.equal(result.content.length, 4);
  const lines = result.content.filter((n) => n.type !== Marker);
  assert.equal(compileMapContent(lines).items.length, 2);
  assert.notEqual(lines[0].props.id, lines[1].props.id);
});
test('Geojson rejects sparse/malformed/unsupported data and bounded expansion before transport', () => {
  const bad = [
    {},
    data(feature('Point', [NaN, 1])),
    data(feature('Point', Array(2))),
    data(feature('GeometryCollection', [])),
    data(feature('LineString', [[0, 0]])),
    data(feature('Polygon', [])),
    { type: 'FeatureCollection', features: Array(1) },
  ];
  for (const geojson of bad)
    assert.throws(() => geo.expandGeojson({ geojson }, Marker, 'test'));
  assert.throws(
    () =>
      geo.expandGeojson(
        {
          geojson: data(
            feature(
              'MultiPoint',
              Array.from({ length: 10001 }, () => [0, 0]),
            ),
          ),
        },
        Marker,
        'test',
      ),
    /limit|budget/i,
  );
  assert.throws(
    () =>
      geo.expandGeojson({ geojson: data(), lineDashPhase: 1 }, Marker, 'test'),
    /dash/i,
  );
});

test('Geojson rejects non-object properties and sparse JSON property arrays', () => {
  for (const properties of ['invalid', 42, { sparse: Array(1) }]) {
    assert.throws(() =>
      geo.expandGeojson(
        { geojson: data(feature('Point', [0, 0], properties)) },
        Marker,
        'test',
      ),
    );
  }
});

test('Geojson rejects oversized nested arrays before reading or copying entries', () => {
  const huge = [];
  huge.length = 100001;
  Object.defineProperty(huge, 0, {
    get() {
      throw new Error('read before bounding');
    },
  });
  assert.throws(
    () =>
      geo.expandGeojson(
        { geojson: data(feature('MultiPoint', huge)) },
        Marker,
        'test',
      ),
    /limit|budget/i,
  );
  assert.throws(
    () =>
      geo.expandGeojson(
        { geojson: data(feature('Point', [0, 0], { huge })) },
        Marker,
        'test',
      ),
    /limit|budget/i,
  );
});

test('Geojson rejects invalid first polygon without expanding the remaining shared graph', () => {
  const polygons = [[[]], null];
  Object.defineProperty(polygons, 1, {
    get() {
      throw new Error('visited another polygon');
    },
  });
  assert.throws(
    () =>
      geo.expandGeojson(
        { geojson: data(feature('MultiPolygon', polygons)) },
        Marker,
        'test',
      ),
    /ring|coordinate count/i,
  );
});
