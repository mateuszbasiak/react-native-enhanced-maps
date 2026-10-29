import type { GeoJSONData } from './layers';
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
export function serializeMapScene(
  sources: readonly (
    | {
        readonly id: string;
        readonly data: GeoJSONData;
        readonly coordinateSpace?: 'unwrapped';
      }
    | { readonly id: string; readonly type: 'raster' }
  )[],
  layers: readonly Readonly<Record<string, unknown>>[],
): string {
  return JSON.stringify({ sources, layers });
}
