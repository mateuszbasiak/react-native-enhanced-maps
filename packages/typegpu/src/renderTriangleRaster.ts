import tgpu from 'typegpu';
import * as d from 'typegpu/data';
import type { ExperimentalRasterOverlay } from 'react-native-enhanced-maps';
import { withGpuValidation } from './gpuValidation';
import { triangleVertex } from './triangleShader';
import { packRasterPixels } from './rasterPixels';

export interface TriangleRasterOptions {
  readonly bounds: ExperimentalRasterOverlay['bounds'];
  readonly color: readonly [number, number, number, number];
  readonly size?: number;
  readonly signal?: AbortSignal;
}

/** Experimental one-shot shader bake. Does not animate or read map camera frames. */
export async function renderTriangleRaster(
  options: TriangleRasterOptions,
): Promise<ExperimentalRasterOverlay> {
  const size = options.size ?? 128;
  if (!Number.isInteger(size) || size < 1 || size > 256)
    throw new RangeError('Shader size must be 1–256');
  if (
    options.color.length !== 4 ||
    !options.color.every((n) => Number.isFinite(n) && n >= 0 && n <= 1)
  )
    throw new RangeError('Shader color must be RGBA values between 0 and 1');
  if (options.signal?.aborted) throw new Error('Shader rendering aborted');
  const root = await tgpu.init();
  let texture: GPUTexture | undefined;
  let readback: GPUBuffer | undefined;
  const color = root.createUniform(d.vec4f, d.vec4f(...options.color));
  try {
    return await withGpuValidation(root.device, async () => {
      if (options.signal?.aborted) throw new Error('Shader rendering aborted');
      const fragment = tgpu
        .fragmentFn({ out: d.vec4f })(`{ return tint; }`)
        .$uses({ tint: color });
      texture = root.device.createTexture({
        size: [size, size],
        format: 'rgba8unorm',
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
      });
      const pipeline = root.createRenderPipeline({
        vertex: triangleVertex,
        fragment,
        targets: { format: 'rgba8unorm' },
      });
      pipeline
        .withColorAttachment({
          view: texture.createView(),
          clearValue: [0, 0, 0, 0],
          loadOp: 'clear',
          storeOp: 'store',
        })
        .draw(3);
      const bytesPerRow = Math.ceil((size * 4) / 256) * 256;
      readback = root.device.createBuffer({
        size: bytesPerRow * size,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
      });
      const encoder = root.device.createCommandEncoder();
      encoder.copyTextureToBuffer(
        { texture },
        { buffer: readback, bytesPerRow },
        [size, size],
      );
      root.device.queue.submit([encoder.finish()]);
      await readback.mapAsync(GPUMapMode.READ);
      if (options.signal?.aborted) throw new Error('Shader rendering aborted');
      return {
        width: size,
        height: size,
        rgbaBase64: packRasterPixels(
          new Uint8Array(readback.getMappedRange()),
          size,
          size,
          bytesPerRow,
        ),
        bounds: options.bounds,
      };
    });
  } finally {
    if (readback?.mapState === 'mapped') readback.unmap();
    readback?.destroy();
    texture?.destroy();
    color.buffer.destroy();
    root.destroy();
  }
}
