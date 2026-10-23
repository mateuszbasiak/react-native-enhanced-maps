import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const load = async () => {
  const { outputText } = ts.transpileModule(
    readFileSync(
      new URL('../example/markers/markerContract.ts', import.meta.url),
      'utf8',
    ),
    {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
      },
    },
  );
  return import(
    `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`
  );
};
test('marker coordinates preserve longitude/latitude order and reject invalid inputs', async () => {
  const { markerPosition } = await load();
  assert.deepEqual(
    markerPosition({ latitude: 54.37, longitude: 18.66 }),
    [18.66, 54.37],
  );
  for (const coordinate of [
    { latitude: NaN, longitude: 0 },
    { latitude: 91, longitude: 0 },
    { latitude: 0, longitude: 181 },
    { latitude: Infinity, longitude: 1 },
  ])
    assert.throws(() => markerPosition(coordinate), RangeError);
  assert.deepEqual(
    markerPosition({ latitude: -90, longitude: -180 }),
    [-180, -90],
  );
});
