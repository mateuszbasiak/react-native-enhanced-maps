import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const load = async () => {
  const source = readFileSync(
    new URL('../example/maplibre/fixtures.ts', import.meta.url),
    'utf8',
  );
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext },
  });
  return import(
    `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`
  );
};
test('fleet has stable unique IDs and valid coordinates/headings at all supported sizes', async () => {
  const { createFleet } = await load();
  for (const count of [100, 1000, 10000]) {
    const fleet = createFleet(count);
    assert.equal(fleet.features.length, count);
    assert.equal(new Set(fleet.features.map((f) => f.id)).size, count);
    for (const f of fleet.features) {
      const [lng, lat] = f.geometry.coordinates;
      assert.ok(lng >= -180 && lng <= 180 && lat >= -85 && lat <= 85);
      assert.ok(f.properties.heading >= 0 && f.properties.heading < 360);
    }
  }
  assert.deepEqual(
    createFleet(100).features,
    createFleet(1000).features.slice(0, 100),
  );
  assert.deepEqual(createFleet(100), createFleet(100));
});
test('fleet rejects invalid sizes before allocating data', async () => {
  const { createFleet } = await load();
  for (const count of [-1, 0, 1.5, NaN, Infinity, 10001])
    assert.throws(() => createFleet(count), RangeError);
});
