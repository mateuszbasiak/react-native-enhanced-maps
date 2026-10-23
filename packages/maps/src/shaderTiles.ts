export interface ShaderTile {
  x: number;
  y: number;
  z: number;
}
/** Native snapshot: unwrapped west, north, east, south in Mercator units, then camera zoom. */
export function selectShaderTiles(view: readonly number[]): ShaderTile[] {
  'worklet';
  if (
    view.length !== 5 ||
    !view.every(Number.isFinite) ||
    view[2]! <= view[0]! ||
    view[3]! <= view[1]!
  )
    throw new Error('Invalid shader viewport');
  let z = Math.max(0, Math.min(18, Math.floor(view[4]!)));
  let x0: number, x1: number, y0: number, y1: number;
  for (;;) {
    const n = 2 ** z;
    x0 = Math.floor(view[0]! * n) - 1;
    x1 = Math.ceil(view[2]! * n);
    y0 = Math.max(0, Math.floor(view[1]! * n) - 1);
    y1 = Math.min(n - 1, Math.ceil(view[3]! * n));
    if ((x1 - x0 + 1) * (y1 - y0 + 1) <= 16 || z === 0) break;
    z--;
  }
  if ((x1 - x0 + 1) * (y1 - y0 + 1) > 16)
    throw new Error('Shader viewport exceeds world-copy budget');
  const tiles: ShaderTile[] = [];
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) tiles.push({ x, y, z });
  return tiles;
}
export function tileWorldRect(tile: ShaderTile): readonly number[] {
  'worklet';
  const scale = 1 / 2 ** tile.z;
  return [tile.x * scale, tile.y * scale, scale];
}
