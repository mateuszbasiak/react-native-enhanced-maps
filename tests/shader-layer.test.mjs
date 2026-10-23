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
