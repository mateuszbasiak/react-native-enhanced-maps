import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as contract from '../packages/maps/lib/shaderContract.js';

const vector = (updates = {}) => ({
  width: 2,
  height: 2,
  bounds: [170, -1, 190, 1],
  projection: 'equirectangular',
  channels: 2,
  units: 'm/s',
  interpolation: 'linear',
  values: new Float32Array([8, 2, 10, 3, 6, 1, 9, 2]),
  mask: new Uint8Array([1, 1, 0, 1]),
  ...updates,
});

test('shader grids accept immutable typed values and compact masks', () => {
  const grid = vector();
  assert.doesNotThrow(() => contract.validateShaderGrid(grid));
  const packed = contract.packShaderGrid(grid);
  assert.deepEqual(packed.values.slice(0, 8), [8, 2, 1, 0, 10, 3, 1, 0]);
  grid.values[0] = 99;
  assert.equal(packed.values[0], 8);
  assert.throws(() =>
    contract.validateShaderGrid(
      vector({ values: new Float32Array([NaN, 0, 0, 0, 0, 0, 0, 0]) }),
    ),
  );
  assert.throws(() =>
    contract.validateShaderGrid(vector({ mask: new Uint8Array([1, 2, 0, 1]) })),
  );
});

test('named fields pack deterministically with independent scalar validity', () => {
  assert.equal(typeof contract.packShaderFields, 'function');
  const detail = vector({
    scalar: new Float32Array([12, 15, 7, 0]),
    scalarMask: new Uint8Array([1, 1, 1, 0]),
  });
  const fields = { detail, backdrop: vector() };
  const packed = contract.packShaderFields(undefined, fields);
  assert.deepEqual(
    packed,
    contract.packShaderFields(undefined, { backdrop: fields.backdrop, detail }),
  );
  assert.deepEqual(packed.values.slice(0, 4), [0, 0, 0, 0]); // absent legacy data
  assert.equal(packed.fields.length, 32); // two 64-byte descriptors
  const offset = packed.fields[28];
  const scalarOffset = packed.fields[29];
  assert.deepEqual(
    packed.values.slice((offset + 2) * 4, (offset + 3) * 4),
    [6, 1, 0, 0],
  );
  assert.deepEqual(
    packed.values.slice((scalarOffset + 2) * 4, (scalarOffset + 3) * 4),
    [7, 0, 1, 0],
  );
  assert.deepEqual(
    packed.values.slice((scalarOffset + 3) * 4, (scalarOffset + 4) * 4),
    [0, 0, 0, 0],
  );
  assert.deepEqual(
    contract.packShaderFields(undefined, {}).fields,
    Array(16).fill(0),
  );
});

test('field validation rejects malformed scalars and unsafe accessor names', () => {
  assert.equal(typeof contract.packShaderFields, 'function');
  for (const fields of [
    { 'bad-name': vector() },
    { bad__name: vector() },
    { detail: vector({ scalarMask: [1, 1, 1, 1] }) },
    { detail: vector({ scalar: [1, 2] }) },
    { detail: vector({ scalar: [1, 2, NaN, 4] }) },
    {
      detail: vector({
        scalar: [1, 2, 3, 4],
        scalarMask: Object.assign(Array(4), { 0: 1, 2: 1, 3: 1 }),
      }),
    },
    {
      detail: vector({
        channels: 1,
        values: [1, 2, 3, 4],
        scalar: [1, 2, 3, 4],
      }),
    },
  ])
    assert.throws(() => contract.packShaderFields(undefined, fields));
});

test('aggregate field payload has a byte budget including legacy data and scalar planes', () => {
  assert.equal(typeof contract.packShaderFields, 'function');
  const large = vector({
    width: 512,
    height: 512,
    values: new Float32Array(512 * 512 * 2),
    mask: undefined,
  });
  assert.doesNotThrow(() =>
    contract.packShaderFields(undefined, { a: large, b: large, c: large }),
  );
  assert.throws(
    () =>
      contract.packShaderFields(large, {
        a: large,
        b: large,
        c: large,
        d: large,
      }),
    /budget/,
  );
});

test('named accessors use sorted slots and expose vector and scalar validity', () => {
  assert.equal(typeof contract.shaderFieldsPrelude, 'function');
  const source = contract.shaderFieldsPrelude(['detail', 'backdrop']);
  assert.equal(source, contract.shaderFieldsPrelude(['backdrop', 'detail']));
  assert.match(
    source,
    /fn mapSampleField_backdrop\(world:vec2f\)->MapFieldSample/,
  );
  assert.match(
    source,
    /fn mapSampleField_detail\(world:vec2f\)->MapFieldSample/,
  );
  assert.match(source, /scalarValid:f32/);
  assert.throws(() => contract.shaderFieldsPrelude(['bad-name']));
});

test('the full sample budget is equally available to legacy and named grids', () => {
  const field = vector({
    width: 1024,
    height: 1024,
    values: new Float32Array(1024 * 1024 * 2),
    mask: undefined,
  });
  assert.equal(
    contract.packShaderFields(undefined, { world: field }).values.length,
    4 + 1024 * 1024 * 4,
  );
  assert.equal(contract.packShaderFields(field).values.length, 1024 * 1024 * 4);
});
