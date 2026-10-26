import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  validateShaderLayer,
  packShaderUniforms,
} from '../packages/maps/lib/shaderContract.js';
import { parseMapQueryResult } from '../packages/maps/lib/mapQueries.js';
const input = {
  id: 'wind',
  shaders: {
    fragment:
      '@fragment fn fragmentMain() -> @location(0) vec4f { return vec4f(0); }',
  },
};
test('shader contract rejects invalid placement, source and uniform packets', () => {
  assert.equal(validateShaderLayer(input).id, 'wind');
  for (const update of [
    { id: '' },
    { coverage: 'local' },
    {
      shaders: { fragment: input.shaders.fragment, compute: 'compute' },
      simulation: { byteLength: 17, workgroups: [1] },
    },
    { simulation: { byteLength: 32, workgroups: [65535, 2] } },
    { shaders: { fragment: '' } },
    { beforeId: 'wind' },
    { placement: 'bad' },
  ])
    assert.throws(() => validateShaderLayer({ ...input, ...update }));
  assert.deepEqual([...packShaderUniforms([1, 2, 3])], [1, 2, 3, 0]);
  assert.equal(packShaderUniforms([]).byteLength, 16);
  assert.throws(() => packShaderUniforms([NaN]));
  assert.throws(() => packShaderUniforms([1e100]));
  assert.throws(() => packShaderUniforms(Array(1025).fill(0)));
});
test('shader lifecycle commands require native acceptance', () => {
  assert.equal(
    parseMapQueryResult('shaderLayer', '{"accepted":true}'),
    undefined,
  );
  assert.throws(() => parseMapQueryResult('shaderLayer', '{"accepted":false}'));
});

test('shader teardown cannot send commands to a replacement style revision', async () => {
  const { createMapReadiness } =
    await import('../packages/maps/lib/capabilities.js');
  const readiness = createMapReadiness('ios');
  const report = JSON.stringify({
    engine: 'maplibre',
    platform: 'ios',
    shaders: 'unvalidated',
    detailedGestures: 'unvalidated',
    layers: {
      circle: 'unvalidated',
      line: 'unvalidated',
      fill: 'unvalidated',
      symbol: 'unsupported',
      raster: 'unsupported',
      heatmap: 'unsupported',
    },
  });
  readiness.activate(0);
  readiness.acceptReport(0, report);
  assert.equal(readiness.isReady(0), true);
  readiness.activate(1);
  readiness.acceptReport(1, report);
  assert.equal(readiness.isReady(0), false);
  assert.equal(readiness.isReady(1), true);
  readiness.deactivate();
  assert.equal(readiness.isReady(1), false);
});

test('geographic grids validate shape, masks, projection and bounded uploads', () => {
  const data = {
    width: 2,
    height: 2,
    bounds: [170, -20, 190, 20],
    projection: 'equirectangular',
    channels: 2,
    units: 'm/s',
    interpolation: 'linear',
    values: [1, 2, 3, 4, 5, 6, 7, 8],
    mask: [1, 0, 1, 1],
  };
  assert.equal(validateShaderLayer({ ...input, data }).data, data);
  for (const update of [
    { width: 0 },
    { height: 1.5 },
    { values: [1] },
    { values: Array(8).fill(NaN) },
    { channels: 3 },
    { mask: [1] },
    { mask: [1, 2, 1, 1] },
    { projection: 'globe' },
    { bounds: [20, -20, 10, 20] },
    { bounds: [0, -90, 10, 90] },
    { interpolation: 'cubic' },
    { units: '' },
    { width: 2049, height: 2049 },
  ])
    assert.throws(() =>
      validateShaderLayer({ ...input, data: { ...data, ...update } }),
    );
});
test('zoom ranges are finite, ordered and may use fractional levels', () => {
  validateShaderLayer({ ...input, minZoom: 5.5, maxZoom: 12.75 });
  for (const update of [
    { minZoom: NaN },
    { maxZoom: Infinity },
    { minZoom: 8, maxZoom: 8 },
    { minZoom: 9, maxZoom: 8 },
  ])
    assert.throws(() => validateShaderLayer({ ...input, ...update }));
});
test('grid packing preserves vector channels, masks and projection metadata', async () => {
  const { packShaderGrid } =
    await import('../packages/maps/lib/shaderContract.js');
  const packed = packShaderGrid({
    width: 2,
    height: 1,
    bounds: [170, -20, 190, 20],
    projection: 'equirectangular',
    channels: 2,
    units: 'm/s',
    interpolation: 'linear',
    values: [4, 5, 6, 7],
    mask: [1, 0],
  });
  assert.deepEqual(packed.values, [4, 5, 1, 0, 6, 7, 0, 0]);
  assert.equal(packed.metadata.length, 12);
  assert.deepEqual(packed.metadata.slice(0, 4), [170, -20, 190, 20]);
  assert.deepEqual(packed.metadata.slice(4, 8), [2, 1, 2, 1]);
  assert.deepEqual(packed.metadata.slice(8, 10), [1, 1]);
  assert.ok(Math.abs(packed.metadata[10] - 0.4432805993614054) < 1e-12);
  assert.ok(Math.abs(packed.metadata[11] - 0.5567194006385946) < 1e-12);
  assert.deepEqual(packShaderGrid(undefined).values, [0, 0, 0, 0]);
});

test('grid validation rejects sparse samples, masks and bounds', () => {
  const data = {
    width: 2,
    height: 2,
    bounds: [0, -10, 10, 10],
    projection: 'mercator',
    channels: 2,
    units: 'm/s',
    interpolation: 'nearest',
    values: Array(8).fill(1),
  };
  for (const update of [
    { values: new Array(8) },
    { mask: new Array(4) },
    { bounds: new Array(4) },
  ])
    assert.throws(() =>
      validateShaderLayer({ ...input, data: { ...data, ...update } }),
    );
});

test('viewport resolution scale rejects invalid density and accepts comparison settings', async () => {
  const { validateShaderOptions } =
    await import('../packages/maps/lib/shaderContract.js');
  const props = { id: 'viewport', shaders: { fragment: 'fragment' } };
  for (const resolutionScale of [0.25, 0.5, 0.75, 1])
    assert.doesNotThrow(() =>
      validateShaderOptions({ ...props, resolutionScale }),
    );
  for (const resolutionScale of [0, -1, 0.249, 1.01, NaN, Infinity])
    assert.throws(
      () => validateShaderOptions({ ...props, resolutionScale }),
      /resolutionScale/,
    );
});
