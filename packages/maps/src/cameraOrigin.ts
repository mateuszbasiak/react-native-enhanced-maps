import type { CameraOrigin } from './types';
/** Unknown or future native reasons must not be guessed from camera deltas. */
export function normalizeCameraOrigin(value: unknown): CameraOrigin {
  return value === 'gesture' || value === 'application' || value === 'sdk'
    ? value
    : 'unknown';
}
