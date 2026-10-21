import assert from 'node:assert/strict';
import { test } from 'node:test';

test('geographic raster boundary rejects oversized, malformed and wrapped payloads', async () => {
  const { validateRasterOverlay } =
    await import('../packages/maps/lib/raster.js');
  const raster = {
    width: 1,
    height: 1,
    rgbaBase64: '/wAA/w==',
    bounds: { north: 53, south: 52, west: 20, east: 21 },
  };
  assert.equal(validateRasterOverlay(raster), raster);
  for (const patch of [
    { width: 257 },
    { width: 1.5 },
    { height: 0 },
    { rgbaBase64: 'AAAA' },
    { rgbaBase64: 'xxxxxxxx' },
    { bounds: { ...raster.bounds, east: 19 } },
    { bounds: { ...raster.bounds, north: 90 } },
    { bounds: { ...raster.bounds, south: NaN } },
  ]) {
    assert.throws(
      () => validateRasterOverlay({ ...raster, ...patch }),
      RangeError,
    );
  }
});

test('GPU readback packing removes row padding and preserves RGBA orientation', async () => {
  const { packRasterPixels } =
    await import('../packages/typegpu/lib/rasterPixels.js');
  const pixels = new Uint8Array(512);
  pixels.set([255, 0, 0, 255]);
  pixels.set([0, 255, 0, 128], 256);
  assert.equal(packRasterPixels(pixels, 1, 2, 256), '/wAA/wD/AIA=');
  assert.throws(() => packRasterPixels(pixels, 0, 2, 256), RangeError);
  assert.throws(() => packRasterPixels(pixels, 1, 3, 256), RangeError);
});

test('TypeGPU triangle vertex resolves to a single valid entry signature', async () => {
  const { triangleVertex } =
    await import('../packages/typegpu/lib/triangleShader.js');
  const { default: tgpu } = await import('typegpu');
  const code = tgpu.resolve([triangleVertex]);
  assert.match(code, /@builtin\(vertex_index\) index: u32/);
  assert.match(code, /positions\[index\]/);
  assert.doesNotMatch(code, /VertexIn|VertexOut|->[^\n{]*\(/);
});

test('GPU validation failure cannot resolve as a successful transparent texture', async () => {
  const { withGpuValidation } =
    await import('../packages/typegpu/lib/gpuValidation.js');
  let popped = 0;
  const device = {
    pushErrorScope(filter) {
      assert.equal(filter, 'validation');
    },
    async popErrorScope() {
      popped++;
      return { message: 'rejected command' };
    },
  };
  await assert.rejects(
    withGpuValidation(device, async () => 'empty pixels'),
    /GPU validation failed/,
  );
  assert.equal(popped, 1);
  await assert.rejects(
    withGpuValidation(device, async () => {
      throw new Error('aborted');
    }),
    /aborted/,
  );
  assert.equal(popped, 2);
});
