import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';

const sample = () => ({
  sourceId: 'boats',
  layerId: 'dots',
  featureId: 'boat-1',
  latitude: 54.37,
  longitude: 18.66,
  x: 20,
  y: 30,
  propertiesJSON: '{"name":"Łódź","nested":{"values":[1,true,null]}}',
});
test('feature hit parser preserves SDK properties and rejects malformed native hits', async () => {
  const url = new URL('../packages/maps/lib/featureHits.js', import.meta.url);
  const code = readFileSync(url, 'utf8').replace(
    /from '(\.\/[^']+)'/g,
    (_, path) => `from '${new URL(path + '.js', url).href}'`,
  );
  const { parseNativeFeatureHit } = await import(
    `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`
  );
  const largeProperties = JSON.stringify({ name: '水'.repeat(1500000) });
  assert(Buffer.byteLength(largeProperties) > 4 * 1024 * 1024);
  assert.equal(
    parseNativeFeatureHit({ ...sample(), propertiesJSON: largeProperties })
      .properties.name.length,
    1500000,
  );
  const hit = parseNativeFeatureHit(sample());
  assert.deepEqual(hit, {
    sourceId: 'boats',
    layerId: 'dots',
    featureId: 'boat-1',
    coordinate: { latitude: 54.37, longitude: 18.66 },
    position: { x: 20, y: 30 },
    properties: { name: 'Łódź', nested: { values: [1, true, null] } },
  });
  for (const patch of [
    { sourceId: '' },
    { layerId: '' },
    { featureId: '' },
    { latitude: 91 },
    { longitude: NaN },
    { x: Infinity },
    { y: null },
    { propertiesJSON: '[' },
    { propertiesJSON: '[]' },
    { propertiesJSON: 'null' },
    { propertiesJSON: '{"x":1e999}' },
    { propertiesJSON: ' '.repeat(4 * 1024 * 1024 + 1) },
  ])
    assert.equal(parseNativeFeatureHit({ ...sample(), ...patch }), null);
  let deep = 1;
  for (let i = 0; i < 18; i++) deep = { nested: deep };
  assert.equal(
    parseNativeFeatureHit({
      ...sample(),
      propertiesJSON: JSON.stringify(deep),
    }),
    null,
  );
});
test('structured feature callback makes a source interactive without changing legacy routing', async () => {
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
  const { compileScene, InternalSource, InternalLayer } = await import(
    `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`
  );
  const hits = [],
    ids = [];
  const scene = compileScene(
    React.createElement(
      InternalSource,
      {
        id: 'boats',
        data: { type: 'FeatureCollection', features: [] },
        onPress: (id) => ids.push(id),
        onFeaturePress: (hit) => hits.push(hit),
      },
      React.createElement(InternalLayer, { id: 'dots', type: 'circle' }),
    ),
  );
  assert.equal(JSON.parse(scene.json).layers[0].interactive, true);
  const hit = { featureId: 'boat-1' };
  scene.presses.get('boats')('boat-1', {});
  scene.featurePresses.get('boats')(hit);
  assert.deepEqual(ids, ['boat-1']);
  assert.deepEqual(hits, [hit]);
  const only = compileScene(
    React.createElement(
      InternalSource,
      {
        id: 'boats',
        data: { type: 'FeatureCollection', features: [] },
        onFeaturePress: () => {},
      },
      React.createElement(InternalLayer, { id: 'dots', type: 'circle' }),
    ),
  );
  assert.equal(JSON.parse(only.json).layers[0].interactive, true);
});
