/** Reserve offscreen coverage without exceeding native texture limits. */
export function shaderViewportPadding(width: number, height: number): number {
  return Math.max(
    0,
    Math.floor(
      Math.min(
        Math.min(width, height) * 0.25,
        (4096 - width) / 2,
        (4096 - height) / 2,
      ),
    ),
  );
}
/** Extend the camera's clip rectangle while retaining physical pixel density. */
export function expandShaderCamera(
  camera: readonly number[],
  padding: number,
): number[] {
  'worklet';
  if (
    camera.length !== 27 ||
    !camera.every(Number.isFinite) ||
    camera[5]! < 1 ||
    camera[6]! < 1 ||
    padding < 0 ||
    !Number.isFinite(padding)
  )
    throw new Error('Invalid shader camera');
  const out = [...camera];
  const sx = camera[5]! / (camera[5]! + 2 * padding),
    sy = camera[6]! / (camera[6]! + 2 * padding);
  out[5] = camera[5]! + 2 * padding;
  out[6] = camera[6]! + 2 * padding;
  // Row-major H: scale clip x/y. H^-1: scale input x/y columns.
  for (let col = 0; col < 3; col++) {
    out[9 + col] = camera[9 + col]! * sx;
    out[12 + col] = camera[12 + col]! * sy;
  }
  for (let row = 0; row < 3; row++) {
    out[18 + row * 3] = camera[18 + row * 3]! / sx;
    out[19 + row * 3] = camera[19 + row * 3]! / sy;
  }
  let west = Infinity,
    north = Infinity,
    east = -Infinity,
    south = -Infinity;
  for (const x of [-1, 1])
    for (const y of [-1, 1]) {
      const w = out[24]! * x + out[25]! * y + out[26]!;
      // No finite ground plane exists beyond the horizon.
      if (w <= 1e-12) return [];
      const px = out[7]! + (out[18]! * x + out[19]! * y + out[20]!) / w;
      const py = out[8]! + (out[21]! * x + out[22]! * y + out[23]!) / w;
      west = Math.min(west, px);
      east = Math.max(east, px);
      north = Math.min(north, py);
      south = Math.max(south, py);
    }
  out[0] = Math.max(-3, west);
  out[1] = Math.max(0, north);
  out[2] = Math.min(4, east);
  out[3] = Math.min(1, south);
  return out;
}

/** Change raster density without changing normalized camera projection or coverage. */
export function scaleShaderCamera(
  camera: readonly number[],
  scale: number,
): number[] {
  'worklet';
  const out = [...camera];
  out[5] = Math.ceil(camera[5]! * scale);
  out[6] = Math.ceil(camera[6]! * scale);
  return out;
}
