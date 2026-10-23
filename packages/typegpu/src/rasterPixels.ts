/** Strip WebGPU row padding without adding a base64 dependency. */
export function packRasterPixels(
  pixels: Uint8Array,
  width: number,
  height: number,
  bytesPerRow: number,
): string {
  if (
    ![width, height].every((n) => Number.isInteger(n) && n >= 1 && n <= 256) ||
    !Number.isInteger(bytesPerRow) ||
    bytesPerRow < width * 4 ||
    pixels.length < bytesPerRow * height
  )
    throw new RangeError('Invalid RGBA readback dimensions');
  const alphabet =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const bytes = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++)
    bytes.set(
      pixels.subarray(y * bytesPerRow, y * bytesPerRow + width * 4),
      y * width * 4,
    );
  let output = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i]!;
    const b = bytes[i + 1] ?? 0;
    const c = bytes[i + 2] ?? 0;
    output +=
      alphabet[a >> 2]! +
      alphabet[((a & 3) << 4) | (b >> 4)]! +
      (i + 1 < bytes.length ? alphabet[((b & 15) << 2) | (c >> 6)]! : '=') +
      (i + 2 < bytes.length ? alphabet[c & 63]! : '=');
  }
  return output;
}
