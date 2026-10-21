import type { MapGestureEvent, MapGestureKind, MapGesturePhase } from './types';
const kinds: readonly string[] = ['pan', 'zoom', 'rotate', 'tilt'];
const phases: readonly string[] = ['begin', 'update', 'end', 'cancel'];
export function validateGestureInterval(value = 50): number {
  if (!Number.isFinite(value) || value < 16 || value > 1000)
    throw new RangeError('gestureEventIntervalMs must be between 16 and 1000');
  return value;
}
export function parseNativeGesture(value: unknown): MapGestureEvent | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const event = value as Record<string, unknown>;
  if (
    typeof event.kind !== 'string' ||
    !kinds.includes(event.kind) ||
    typeof event.phase !== 'string' ||
    !phases.includes(event.phase) ||
    typeof event.id !== 'number' ||
    !Number.isSafeInteger(event.id) ||
    event.id <= 0 ||
    typeof event.timestampMs !== 'number' ||
    !Number.isFinite(event.timestampMs) ||
    event.timestampMs < 0 ||
    typeof event.x !== 'number' ||
    !Number.isFinite(event.x) ||
    typeof event.y !== 'number' ||
    !Number.isFinite(event.y)
  )
    return null;
  return {
    kind: event.kind as MapGestureKind,
    phase: event.phase as MapGesturePhase,
    id: event.id,
    timestampMs: event.timestampMs,
    position: { x: event.x, y: event.y },
  };
}
