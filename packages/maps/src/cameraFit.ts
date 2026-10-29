import type { Coordinate, FitOptions } from './types';
export function fitRequest(
  coordinates?: readonly Coordinate[],
  options: FitOptions = {},
) {
  if (
    coordinates !== undefined &&
    (!Array.isArray(coordinates) || coordinates.length < 1)
  )
    throw new RangeError('Fit requires at least one coordinate');
  let coordinatesJSON = '';
  if (coordinates !== undefined) {
    const positions: [number, number][] = [];
    // Visit every index: map() skips sparse entries that JSON turns into null.
    for (let index = 0; index < coordinates.length; index++) {
      const value = coordinates[index];
      if (
        !value ||
        !Number.isFinite(value.latitude) ||
        !Number.isFinite(value.longitude) ||
        Math.abs(value.latitude) > 90 ||
        Math.abs(value.longitude) > 180
      )
        throw new RangeError('Invalid fit coordinate');
      positions.push([value.latitude, value.longitude]);
    }
    coordinatesJSON = JSON.stringify(positions);
  }
  const padding = options.padding ?? 0;
  const edges =
    typeof padding === 'number'
      ? { top: padding, right: padding, bottom: padding, left: padding }
      : padding;
  for (const edge of [edges?.top, edges?.right, edges?.bottom, edges?.left])
    if (
      typeof edge !== 'number' ||
      !Number.isFinite(edge) ||
      edge < 0 ||
      edge > 100000
    )
      throw new RangeError(
        'Fit padding must contain finite nonnegative logical points',
      );
  const durationMs = options.durationMs ?? 300;
  if (!Number.isFinite(durationMs) || durationMs < 0 || durationMs > 60000)
    throw new RangeError('Fit duration must be between 0 and 60000ms');
  return {
    coordinatesJSON,
    top: edges.top,
    right: edges.right,
    bottom: edges.bottom,
    left: edges.left,
    durationMs,
  };
}
