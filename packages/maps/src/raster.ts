import type { ExperimentalRasterOverlay } from './types';

/** Bounded prototype: straight-alpha RGBA8, row zero at geographic north. */
export function validateRasterOverlay(
  raster: ExperimentalRasterOverlay,
): ExperimentalRasterOverlay {
  const { width, height, rgbaBase64, bounds: b } = raster;
  if (![width, height].every((n) => Number.isInteger(n) && n >= 1 && n <= 256))
    throw new RangeError(
      'Raster dimensions must be integers between 1 and 256',
    );
  if (
    !b ||
    ![b.north, b.south, b.east, b.west].every(Number.isFinite) ||
    b.north > 85 ||
    b.south < -85 ||
    b.north <= b.south ||
    b.west < -180 ||
    b.east > 180 ||
    b.east <= b.west ||
    b.east - b.west > 180
  )
    throw new RangeError(
      'Raster bounds must be ordered, within ±85 latitude, and span at most 180 longitude degrees',
    );
  const bytes = width * height * 4;
  const padding = (3 - (bytes % 3)) % 3;
  if (
    typeof rgbaBase64 !== 'string' ||
    rgbaBase64.length !== Math.ceil(bytes / 3) * 4 ||
    !/^[A-Za-z0-9+/]*={0,2}$/.test(rgbaBase64) ||
    (rgbaBase64.match(/=/g)?.length ?? 0) !== padding
  )
    throw new RangeError(
      'Raster must contain exactly width × height straight-alpha RGBA8 bytes as base64',
    );
  return raster;
}
