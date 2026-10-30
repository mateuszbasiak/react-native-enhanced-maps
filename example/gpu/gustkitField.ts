import type { ShaderField } from 'react-native-maplibre-maps/shaders';

/** Structural subset of @gustkit/client 1.4 FlowGrid; no SDK dependency needed. */
interface FlowGrid {
  west: number;
  south: number;
  stepX: number;
  stepY: number;
  width: number;
  height: number;
  u: Float32Array;
  v: Float32Array;
  scalar: Float32Array | null;
}
/** Copy a decoded GustKit snapshot once, keeping its exact geographic lattice.
 * The source must already have loaded the requested region/time/level.
 * A separate scalar keeps its product-specific units; u/v always remain m/s.
 */
export function gustkitField(grid: FlowGrid): ShaderField {
  const { width, height, stepX, stepY, south } = grid;
  if (
    !Number.isSafeInteger(width) ||
    width < 2 ||
    !Number.isSafeInteger(height) ||
    height < 2 ||
    ![grid.west, south, stepX, stepY].every(Number.isFinite) ||
    stepX <= 0 ||
    stepY <= 0 ||
    width * height > 1048576 ||
    grid.u.length !== width * height ||
    grid.v.length !== width * height ||
    (grid.scalar !== null && grid.scalar.length !== width * height)
  )
    throw new Error('Invalid GustKit sample lattice');
  const span = (width - 1) * stepX;
  if (span > 360)
    throw new Error(
      'GustKit longitude span exceeds 360 degrees; request or resample a world lattice',
    );
  const limit = 85.0511287798066;
  const firstRow = Math.max(0, Math.ceil((-limit - south) / stepY));
  const lastRow = Math.min(height - 1, Math.floor((limit - south) / stepY));
  const rows = lastRow - firstRow + 1;
  if (rows < 2)
    throw new Error(
      'GustKit grid needs two rows inside Mercator latitude bounds',
    );
  const values = new Float32Array(width * rows * 2);
  const mask = new Uint8Array(width * rows);
  const scalar =
    grid.scalar === null ? undefined : new Float32Array(width * rows);
  const scalarMask = scalar ? new Uint8Array(width * rows) : undefined;
  for (let row = 0; row < rows; row++)
    for (let column = 0; column < width; column++) {
      const source = (lastRow - row) * width + column;
      const target = row * width + column;
      const u = grid.u[source]!,
        v = grid.v[source]!;
      if (Number.isFinite(u) && Number.isFinite(v)) {
        values[target * 2] = u;
        values[target * 2 + 1] = v;
        mask[target] = 1;
      }
      if (scalar && scalarMask && grid.scalar) {
        const value = grid.scalar[source]!;
        if (Number.isFinite(value)) {
          scalar[target] = value;
          scalarMask[target] = 1;
        }
      }
    }
  const west = ((((grid.west + 180) % 360) + 360) % 360) - 180;
  return {
    width,
    height: rows,
    bounds: [
      west,
      south + firstRow * stepY,
      west + span,
      south + lastRow * stepY,
    ],
    projection: 'equirectangular',
    channels: 2,
    units: 'm/s',
    interpolation: 'linear',
    values,
    mask,
    ...(scalar ? { scalar, scalarMask: scalarMask! } : {}),
  };
}
