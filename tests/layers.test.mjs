import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
const load = () => import('../packages/maps/lib/layers.js');
const data = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      id: 'route',
      properties: {},
      geometry: {
        type: 'LineString',
        coordinates: [
          [21, 52],
          [21.1, 52.1],
        ],
      },
    },
  ],
};
test('source/layer graph shares data and preserves declaration order', async () => {
  const { compileLayers, GeoJSONSource, LineLayer } = await load();
  const scene = compileLayers(
    React.createElement(
      GeoJSONSource,
      { id: 'roads', revision: 1, data },
      React.createElement(LineLayer, {
        id: 'outline',
        style: { lineColor: '#123456', lineWidth: 8 },
      }),
      React.createElement(LineLayer, {
        id: 'route',
        style: { lineColor: '#0088ff', lineWidth: 4 },
      }),
    ),
  );
  assert.equal(scene.sources.length, 1);
  assert.deepEqual(
    scene.layers.map((l) => [l.id, l.source]),
    [
      ['outline', 'roads'],
      ['route', 'roads'],
    ],
  );
});
test('fragments and separate source references resolve without mounting order dependence', async () => {
  const { compileLayers, GeoJSONSource, LineLayer } = await load();
  const scene = compileLayers(
    React.createElement(
      React.Fragment,
      null,
      React.createElement(LineLayer, {
        id: 'route',
        source: 'roads',
        style: { lineColor: '#0088ff' },
      }),
      React.createElement(GeoJSONSource, { id: 'roads', revision: 1, data }),
    ),
  );
  assert.equal(scene.layers[0].source, 'roads');
  assert.deepEqual(compileLayers(null), { sources: [], layers: [] });
});
test('graph rejects duplicate IDs, missing sources and unsupported children', async () => {
  const { compileLayers, GeoJSONSource, LineLayer } = await load();
  assert.throws(
    () =>
      compileLayers([
        React.createElement(GeoJSONSource, { id: 'x', revision: 1, data }),
        React.createElement(GeoJSONSource, { id: 'x', revision: 1, data }),
      ]),
    /Duplicate/,
  );
  assert.throws(
    () =>
      compileLayers(
        React.createElement(LineLayer, {
          id: 'x',
          source: 'missing',
          style: {},
        }),
      ),
    /source/,
  );
  assert.throws(() => compileLayers(React.createElement('div')), /Unsupported/);
});
test('geometry, revisions, IDs and styles are validated before native serialization', async () => {
  const { compileLayers, GeoJSONSource, LineLayer } = await load();
  for (const patch of [
    { id: '' },
    { revision: -1 },
    { revision: 1.5 },
    {
      data: {
        ...data,
        features: [
          {
            ...data.features[0],
            geometry: {
              type: 'LineString',
              coordinates: [
                [NaN, 52],
                [21, 52],
              ],
            },
          },
        ],
      },
    },
  ]) {
    assert.throws(() =>
      compileLayers(
        React.createElement(GeoJSONSource, {
          id: 'x',
          revision: 1,
          data,
          ...patch,
        }),
      ),
    );
  }
  for (const style of [
    { lineWidth: -1 },
    { lineOpacity: 2 },
    { lineColor: 'red' },
    { unknown: 1 },
  ]) {
    assert.throws(() =>
      compileLayers(
        React.createElement(
          GeoJSONSource,
          { id: 'x', revision: 1, data },
          React.createElement(LineLayer, { id: 'l', style }),
        ),
      ),
    );
  }
});
test('style changes reuse the source payload, revisions guard data replacement, and removal releases it', async () => {
  const { compileLayers, reuseLayerScene, GeoJSONSource, LineLayer } =
    await load();
  const make = (revision, sourceData, width) =>
    compileLayers(
      React.createElement(
        GeoJSONSource,
        { id: 'roads', revision, data: sourceData },
        React.createElement(LineLayer, {
          id: 'route',
          style: { lineWidth: width },
        }),
      ),
    );
  const first = make(1, data, 4);
  const styled = reuseLayerScene(first, make(1, data, 8));
  assert.equal(styled.sources, first.sources);
  assert.notEqual(styled.layers, first.layers);
  const replacement = structuredClone(data);
  assert.throws(
    () => reuseLayerScene(first, make(1, replacement, 4)),
    /revision/,
  );
  const next = reuseLayerScene(first, make(2, replacement, 4));
  assert.notEqual(next.sources, first.sources);
  assert.throws(() => reuseLayerScene(next, make(1, data, 4)), /revision/);
  assert.deepEqual(reuseLayerScene(next, compileLayers(null)), {
    sources: [],
    layers: [],
  });
});
test('polygon holes and multi-geometries are accepted; open rings are rejected', async () => {
  const { compileLayers, GeoJSONSource, FillLayer } = await load();
  const outer = [
    [21, 52],
    [21.1, 52],
    [21.1, 52.1],
    [21, 52],
  ];
  const hole = [
    [21.02, 52.01],
    [21.03, 52.01],
    [21.03, 52.02],
    [21.02, 52.01],
  ];
  const area = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        id: 'area',
        properties: null,
        geometry: { type: 'MultiPolygon', coordinates: [[outer, hole]] },
      },
    ],
  };
  assert.equal(
    compileLayers(
      React.createElement(
        GeoJSONSource,
        { id: 'areas', revision: 1, data: area },
        React.createElement(FillLayer, { id: 'fill', style: {} }),
      ),
    ).layers[0].type,
    'fill',
  );
  const invalid = structuredClone(area);
  invalid.features[0].geometry.coordinates[0][0].pop();
  assert.throws(
    () =>
      compileLayers(
        React.createElement(GeoJSONSource, {
          id: 'areas',
          revision: 2,
          data: invalid,
        }),
      ),
    /ring/,
  );
});
test('property traversal is bounded before serializing aliased trees', async () => {
  const { compileLayers, GeoJSONSource } = await load();
  let tree = { value: 1 };
  for (let i = 0; i < 15; i++) tree = { a: tree, b: tree };
  const aliased = {
    ...data,
    features: [{ ...data.features[0], properties: tree }],
  };
  assert.throws(
    () =>
      compileLayers(
        React.createElement(GeoJSONSource, {
          id: 'data',
          revision: 1,
          data: aliased,
        }),
      ),
    /limit/,
  );
});
test('unsupported source and layer options fail explicitly', async () => {
  const { compileLayers, GeoJSONSource, LineLayer } = await load();
  assert.throws(
    () =>
      compileLayers(
        React.createElement(GeoJSONSource, {
          id: 'data',
          revision: 1,
          data,
          cluster: true,
        }),
      ),
    /Unsupported/,
  );
  assert.throws(
    () =>
      compileLayers(
        React.createElement(
          GeoJSONSource,
          { id: 'data', revision: 1, data },
          React.createElement(LineLayer, {
            id: 'line',
            style: {},
            filter: ['has', 'name'],
          }),
        ),
      ),
    /Unsupported/,
  );
});
