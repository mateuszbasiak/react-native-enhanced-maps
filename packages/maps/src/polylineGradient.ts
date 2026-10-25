import type { Coordinate } from './types';
export type GradientStops = readonly (readonly [
  offset: number,
  color: string,
])[];
const cache = new WeakMap<
  readonly Coordinate[],
  WeakMap<readonly string[], GradientStops>
>();
const radians = Math.PI / 180;
const mercatorY = (latitude: number): number =>
  Math.log(Math.tan(Math.PI / 4 + (latitude * radians) / 2));

/** Geometry/colors are validated immutable inputs; indices preserve original geodesic vertices. */
export function polylineGradient(
  path: readonly Coordinate[],
  colors: readonly string[],
  vertexIndices?: readonly number[],
): GradientStops {
  const variants =
    cache.get(path) ?? new WeakMap<readonly string[], GradientStops>();
  const old = variants.get(colors);
  if (old) return old;
  const lengths = [0];
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1]!,
      b = path[i]!;
    lengths.push(
      lengths[i - 1]! +
        Math.hypot(
          (b.longitude - a.longitude) * radians,
          mercatorY(b.latitude) - mercatorY(a.latitude),
        ),
    );
  }
  const total = lengths.at(-1)!;
  const stops: [number, string][] = [];
  if (total === 0) stops.push([0, colors.at(-1)!], [1, colors.at(-1)!]);
  else
    for (let i = 0; i < colors.length; i++) {
      const offset = lengths[vertexIndices?.[i] ?? i]! / total;
      const stop: [number, string] = [offset, colors[i]!];
      if (stops.at(-1)?.[0] === offset) stops[stops.length - 1] = stop;
      else stops.push(stop);
    }
  variants.set(colors, stops);
  cache.set(path, variants);
  return stops;
}
