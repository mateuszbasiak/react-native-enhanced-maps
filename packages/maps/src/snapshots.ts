/** Snapshot of the mounted viewport; output dimensions are physical pixels. */
export interface SnapshotOptions {
  readonly width?: number;
  readonly height?: number;
  readonly format?: 'png' | 'jpg';
  readonly quality?: number;
  readonly result?: 'file' | 'base64';
}
export const MAX_SNAPSHOT_PIXELS = 16_000_000;
export const MAX_SNAPSHOT_BYTES = 32 * 1024 * 1024;
export const MAX_SNAPSHOT_RESULT_CHARS =
  Math.ceil(MAX_SNAPSHOT_BYTES / 3) * 4 + 1024;
export function snapshotRequest(
  options: SnapshotOptions = {},
): Record<string, string | number> {
  if (
    !options ||
    typeof options !== 'object' ||
    Array.isArray(options) ||
    Object.keys(options).some(
      (key) =>
        !['width', 'height', 'format', 'quality', 'result'].includes(key),
    )
  )
    throw new TypeError(
      'Snapshot supports mounted viewport width, height, format, quality and result only',
    );
  const dimension = (value: number | undefined) => {
    if (value === undefined) return 0;
    if (!Number.isInteger(value) || value < 1 || value > 4096)
      throw new RangeError(
        'Snapshot dimensions must be integers within 1–4096 pixels',
      );
    return value;
  };
  const width = dimension(options.width),
    height = dimension(options.height);
  if (width * height > MAX_SNAPSHOT_PIXELS)
    throw new RangeError('Snapshot exceeds 16000000 pixels');
  const format = options.format ?? 'png',
    result = options.result ?? 'file',
    quality = options.quality ?? 1;
  if (format !== 'png' && format !== 'jpg')
    throw new TypeError('Snapshot format must be png or jpg');
  if (result !== 'file' && result !== 'base64')
    throw new TypeError('Snapshot result must be file or base64');
  if (!Number.isFinite(quality) || quality < 0 || quality > 1)
    throw new RangeError('Snapshot quality must be within [0,1]');
  return { width, height, format, quality, result };
}
/** Native transports an envelope so base64 data is never mistaken for a path. */
export function parseSnapshotResult(json: string): string {
  if (typeof json !== 'string' || json.length > MAX_SNAPSHOT_RESULT_CHARS)
    throw new Error('Invalid native snapshot result');
  let result: unknown;
  try {
    result = JSON.parse(json);
  } catch {
    throw new Error('Invalid native snapshot result');
  }
  const r = result as { value?: unknown; file?: unknown } | null;
  if (
    !r ||
    typeof r.value !== 'string' ||
    typeof r.file !== 'boolean' ||
    !r.value
  )
    throw new Error('Invalid native snapshot result');
  if (r.file) {
    if (
      r.value.length > 2048 ||
      r.value.includes(String.fromCharCode(0)) ||
      !/^file:\/\/\/.+\.(png|jpg)$/.test(r.value)
    )
      throw new Error('Invalid native snapshot result');
  } else if (
    r.value.length > Math.ceil(MAX_SNAPSHOT_BYTES / 3) * 4 ||
    r.value.length % 4 !== 0 ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(r.value)
  )
    throw new Error('Invalid native snapshot result');
  return r.value;
}
