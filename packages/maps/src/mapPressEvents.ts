import type { MapPressEvent } from './types';

export function parseNativeMapPress(
  value: unknown,
): Pick<MapPressEvent, 'action' | 'coordinate' | 'position'> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const e = value as Record<string, unknown>;
  if (e.action !== 'tap' && e.action !== 'long-press') return null;
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
  return {
    action: e.action,
    coordinate: {
      latitude: e.latitude as number,
      longitude: e.longitude as number,
    },
    position: { x: e.x as number, y: e.y as number },
  };
}
