import { utf8ByteLength } from './sceneBudget';
import type { MapFeaturePressEvent } from './types';

/** Validate the bounded SDK hit payload before dispatching public callbacks. */
export function parseNativeFeatureHit(
  value: unknown,
): MapFeaturePressEvent | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const e = value as Record<string, unknown>;
  if (
    [e.sourceId, e.layerId, e.featureId].some(
      (id) => typeof id !== 'string' || !id.length || id.length > 512,
    )
  )
    return null;
  if (
    [e.latitude, e.longitude, e.x, e.y].some(
      (n) => typeof n !== 'number' || !Number.isFinite(n),
    )
  )
    return null;
  if (
    Math.abs(e.latitude as number) > 90 ||
    Math.abs(e.longitude as number) > 180
  )
    return null;
  if (
    typeof e.propertiesJSON !== 'string' ||
    e.propertiesJSON.length > 4 * 1024 * 1024 ||
    utf8ByteLength(e.propertiesJSON) > 4 * 1024 * 1024
  )
    return null;
  const validJSON = (v: unknown, depth: number): boolean => {
    if (depth > 16) return false;
    if (v === null || typeof v === 'string' || typeof v === 'boolean')
      return true;
    if (typeof v === 'number') return Number.isFinite(v);
    if (Array.isArray(v)) return v.every((item) => validJSON(item, depth + 1));
    return (
      typeof v === 'object' &&
      Object.values(v as object).every((item) => validJSON(item, depth + 1))
    );
  };
  try {
    const properties: unknown = JSON.parse(e.propertiesJSON);
    if (
      !properties ||
      typeof properties !== 'object' ||
      Array.isArray(properties) ||
      !validJSON(properties, 0)
    )
      return null;
    return {
      sourceId: e.sourceId as string,
      layerId: e.layerId as string,
      featureId: e.featureId as string,
      properties: properties as MapFeaturePressEvent['properties'],
      coordinate: {
        latitude: e.latitude as number,
        longitude: e.longitude as number,
      },
      position: { x: e.x as number, y: e.y as number },
    };
  } catch {
    return null;
  }
}
