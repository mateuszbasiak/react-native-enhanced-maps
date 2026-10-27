import type { GeoJSONData } from './layers';
const MAX_SCENE_BYTES = 4 * 1024 * 1024;
const counts = new WeakMap<GeoJSONData, number>();

/** UTF-8 size without depending on Buffer or TextEncoder in React Native. */
export function utf8ByteLength(value: string): number {
  let bytes = 0;
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code <= 0x7f) bytes++;
    else if (code <= 0x7ff) bytes += 2;
    else if (
      code >= 0xd800 &&
      code <= 0xdbff &&
      value.charCodeAt(i + 1) >= 0xdc00 &&
      value.charCodeAt(i + 1) <= 0xdfff
    ) {
      bytes += 4;
      i++;
    } else bytes += 3;
  }
  return bytes;
}
function positionCount(data: GeoJSONData): number {
  const cached = counts.get(data);
  if (cached !== undefined) return cached;
  // Input has already passed bounded geometry validation (including shape compilation).
  const positions = (coordinates: unknown): number => {
    if (!Array.isArray(coordinates) || coordinates.length === 0) return 0;
    if (typeof coordinates[0] === 'number') return 1;
    return coordinates.reduce<number>(
      (sum, child) => sum + positions(child),
      0,
    );
  };
  const count = data.features.reduce(
    (sum, feature) => sum + positions(feature.geometry.coordinates),
    0,
  );
  counts.set(data, count);
  return count;
}
export function serializeMapScene(
  sources: readonly (
    | { readonly id: string; readonly data: GeoJSONData }
    | { readonly id: string; readonly type: 'raster' }
  )[],
  layers: readonly Readonly<Record<string, unknown>>[],
): string {
  const positions = new Map<string, number>();
  let declared = 0;
  for (const source of sources) {
    const count = 'data' in source ? positionCount(source.data) : 0;
    declared += count;
    if (declared > 50000) throw new Error('Scene position limit exceeded');
    positions.set(source.id, count);
  }
  let rendered = 0;
  for (const layer of layers) {
    rendered += positions.get(layer.source as string) ?? 0;
    if (rendered > 100000)
      throw new Error('Rendered scene position limit exceeded');
  }
  const json = JSON.stringify({ sources, layers });
  if (json.length > MAX_SCENE_BYTES || utf8ByteLength(json) > MAX_SCENE_BYTES)
    throw new Error('Scene exceeds 4 MiB UTF-8 byte limit');
  return json;
}
