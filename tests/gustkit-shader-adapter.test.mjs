import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';
import { packShaderFields } from '../packages/maps/lib/shaderContract.js';
async function adapter() {
  const source = readFileSync(
    new URL('../example/gpu/gustkitField.ts', import.meta.url),
    'utf8',
  );
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  return (
    await import(
      `data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`
    )
  ).gustkitField;
}
const input = () => ({
  west: 170,
  south: -1,
  stepX: 10,
  stepY: 2,
  width: 3,
  height: 2,
  u: new Float32Array([1, NaN, 3, 4, 5, 6]),
  v: new Float32Array([10, 20, 30, 40, 50, 60]),
  scalar: new Float32Array([11, 12, NaN, 14, NaN, 16]),
});
test('GustKit conversion preserves exact lattice and independent missing scalar/vector samples', async () => {
  const convert = await adapter();
  const field = convert(input());
  assert.deepEqual(field.bounds, [170, -1, 190, 1]);
  assert.deepEqual(
    [...field.values],
    [4, 40, 5, 50, 6, 60, 1, 10, 0, 0, 3, 30],
  );
  assert.deepEqual([...field.mask], [1, 1, 1, 1, 0, 1]);
  assert.deepEqual([...field.scalar], [14, 0, 16, 11, 12, 0]);
  assert.deepEqual([...field.scalarMask], [1, 0, 1, 1, 1, 0]);
  assert.doesNotThrow(() => packShaderFields(undefined, { detail: field }));
});
test('GustKit polar cropping keeps actual remaining sample coordinates', async () => {
  const convert = await adapter();
  const grid = {
    ...input(),
    west: 530,
    south: -90,
    stepY: 30,
    height: 7,
    u: new Float32Array(21).fill(3),
    v: new Float32Array(21).fill(4),
    scalar: null,
  };
  const field = convert(grid);
  assert.deepEqual(field.bounds, [170, -60, 190, 60]);
  assert.equal(field.height, 5);
  assert.equal(field.scalar, undefined);
  assert.doesNotThrow(() => packShaderFields(undefined, { backdrop: field }));
  assert.throws(() => convert({ ...input(), stepX: 181 }), /360/);
});
