import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';

test('cluster options normalize defaults and reject unbounded or ambiguous inputs', async () => {
  const { normalizeClusterOptions } =
    await import('../packages/maps/lib/clustering.js');
  assert.equal(normalizeClusterOptions(undefined), undefined);
  assert.equal(normalizeClusterOptions(false), undefined);
  assert.deepEqual(normalizeClusterOptions(true), {
    radius: 50,
    maxZoom: 14,
    minPoints: 2,
  });
  assert.deepEqual(
    normalizeClusterOptions({ radius: 80, maxZoom: 0, minPoints: 3 }),
    { radius: 80, maxZoom: 0, minPoints: 3 },
  );
  for (const input of [
    null,
    1,
    'yes',
    [],
    { radius: 0 },
    { radius: 513 },
    { radius: 1.5 },
    { maxZoom: 18 },
    { maxZoom: NaN },
    { minPoints: 1 },
    { minPoints: 10001 },
    { extra: true },
  ])
    assert.throws(() => normalizeClusterOptions(input));
});

test('scene transport preserves normalized clustering and independent cluster/point layers', async () => {
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
  const { compileScene, InternalSource, InternalLayer } = await import(
    `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`
  );
  const data = { type: 'FeatureCollection', features: [] };
  const content = (cluster, filter = 'clusters') =>
    React.createElement(
      InternalSource,
      { id: 'points', revision: 3, data, cluster },
      React.createElement(InternalLayer, {
        id: 'dots',
        type: 'circle',
        clusterFilter: filter,
      }),
    );
  const scene = JSON.parse(compileScene(content(true)).json);
  assert.deepEqual(scene.sources[0].cluster, {
    radius: 50,
    maxZoom: 14,
    minPoints: 2,
  });
  assert.equal(scene.sources[0].revision, 3);
  assert.equal(scene.layers[0].clusterFilter, 'clusters');
  assert.equal(
    JSON.parse(compileScene(content({ radius: 30 }, 'points')).json).sources[0]
      .cluster.radius,
    30,
  );
  assert.throws(() => compileScene(content(false)));
  assert.throws(() => compileScene(content(true, 'other')));
});

test('cluster input requires points without reserved generated-cluster properties', async () => {
  const { validateClusterData } =
    await import('../packages/maps/lib/clustering.js');
  const data = (geometry, properties = {}) => ({
    type: 'FeatureCollection',
    features: [{ type: 'Feature', id: 'a', properties, geometry }],
  });
  const point = { type: 'Point', coordinates: [18.66, 54.37] };
  assert.doesNotThrow(() => validateClusterData(data(point)));
  assert.doesNotThrow(() => validateClusterData(data(point, null)));
  const reservedID = data(point);
  reservedID.features[0].id = 'cluster:14';
  assert.doesNotThrow(() => validateClusterData(reservedID));
  for (const name of [
    'cluster',
    'cluster_id',
    'point_count',
    'point_count_abbreviated',
    '__enhanced_maps_cluster_index',
  ])
    assert.throws(() => validateClusterData(data(point, { [name]: 1 })));
  assert.throws(() =>
    validateClusterData(
      data({ type: 'MultiPoint', coordinates: [[18.66, 54.37]] }),
    ),
  );
});
