import type { Coordinate } from './types';

type Path = readonly Coordinate[];
type Polygon = { readonly coordinates: Path; readonly holes: readonly Path[] };
const radians = Math.PI / 180;
const maxStep = 0.25 * radians;
const maxLatitude = 85 * radians;
type GeodesicPath = {
  readonly coordinates: Path;
  readonly vertexIndices: readonly number[];
};
const paths = new WeakMap<Path, GeodesicPath>();
const polygons = new WeakMap<Path, WeakMap<readonly Path[], Polygon>>();
const vector = (p: Coordinate): readonly [number, number, number] => {
  const lat = p.latitude * radians,
    lon = p.longitude * radians;
  return [
    Math.cos(lat) * Math.cos(lon),
    Math.cos(lat) * Math.sin(lon),
    Math.sin(lat),
  ];
};
const unwrap = (longitude: number, previous: number): number =>
  longitude + 360 * Math.round((previous - longitude) / 360);
const latitude = (z: number): number => Math.asin(Math.max(-1, Math.min(1, z)));

/** Input is already validated, immutable component geometry. No camera-dependent work. */
export function geodesicPathInfo(input: Path): GeodesicPath {
  const cached = paths.get(input);
  if (cached) return cached;
  const output: Coordinate[] = [input[0]!];
  const vertexIndices = [0];
  for (let i = 1; i < input.length; i++) {
    const start = input[i - 1]!,
      end = input[i]!;
    const a = vector(start),
      b = vector(end);
    const cross = [
      a[1] * b[2] - a[2] * b[1],
      a[2] * b[0] - a[0] * b[2],
      a[0] * b[1] - a[1] * b[0],
    ];
    const sine = Math.hypot(...cross);
    const cosine = Math.max(
      -1,
      Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]),
    );
    if (sine < 1e-10 && cosine < 0)
      throw new RangeError(
        'Antipodal geodesic endpoints have no unique shortest arc',
      );
    const angle = Math.atan2(sine, cosine);
    const steps = Math.max(1, Math.ceil(angle / maxStep));
    if (output.length + steps > 10000)
      throw new RangeError('Geodesic point resource limit exceeded');
    if (angle > 1e-12) {
      const tangent = b.map((v, axis) => (v - cosine * a[axis]!) / sine);
      // Check the analytic latitude extrema, including those between sample points.
      const stationary = Math.atan2(tangent[2]!, a[2]);
      for (let k = -1; k <= 1; k++) {
        const t = stationary + k * Math.PI;
        if (
          t > 0 &&
          t < angle &&
          Math.abs(latitude(a[2] * Math.cos(t) + tangent[2]! * Math.sin(t))) >
            maxLatitude + 1e-12
        )
          throw new RangeError('Geodesic arc exceeds supported latitude');
      }
      for (let step = 1; step < steps; step++) {
        const t = (angle * step) / steps;
        const p = a.map(
          (v, axis) => v * Math.cos(t) + tangent[axis]! * Math.sin(t),
        );
        output.push({
          latitude: latitude(p[2]!) / radians,
          longitude: unwrap(
            Math.atan2(p[1]!, p[0]!) / radians,
            output.at(-1)!.longitude,
          ),
        });
      }
    }
    output.push({
      latitude: end.latitude,
      longitude: unwrap(end.longitude, output.at(-1)!.longitude),
    });
    vertexIndices.push(output.length - 1);
  }
  const result = { coordinates: output, vertexIndices };
  paths.set(input, result);
  return result;
}
export function geodesicPath(input: Path): Path {
  return geodesicPathInfo(input).coordinates;
}
function closedPath(input: Path): Path {
  const path = geodesicPath(input);
  if (Math.abs(path.at(-1)!.longitude - path[0]!.longitude) > 1e-8)
    throw new RangeError(
      'Geodesic polygon winding around a pole is unsupported',
    );
  return path;
}
const mercatorY = (latitude: number): number =>
  Math.log(Math.tan(Math.PI / 4 + (latitude * radians) / 2));
function contains(
  points: readonly { x: number; y: number }[],
  x: number,
  y: number,
): boolean {
  let inside = false;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!,
      b = points[i]!;
    const cross = (x - a.x) * (b.y - a.y) - (y - a.y) * (b.x - a.x);
    if (
      Math.abs(cross) < 1e-9 &&
      x >= Math.min(a.x, b.x) - 1e-9 &&
      x <= Math.max(a.x, b.x) + 1e-9 &&
      y >= Math.min(a.y, b.y) - 1e-9 &&
      y <= Math.max(a.y, b.y) + 1e-9
    )
      return true;
    if (
      a.y > y !== b.y > y &&
      x < a.x + ((y - a.y) * (b.x - a.x)) / (b.y - a.y)
    )
      inside = !inside;
  }
  return inside;
}
export function geodesicPolygon(input: Path, holes: readonly Path[]): Polygon {
  const variants =
    polygons.get(input) ?? new WeakMap<readonly Path[], Polygon>();
  const cached = variants.get(holes);
  if (cached) return cached;
  const coordinates = closedPath(input);
  let points = coordinates.length;
  const exterior = coordinates.map((p) => ({
    x: p.longitude,
    y: mercatorY(p.latitude),
  }));
  let west = Infinity,
    east = -Infinity;
  for (const p of exterior) {
    west = Math.min(west, p.x);
    east = Math.max(east, p.x);
  }
  const aligned = holes.map((hole) => {
    const path = closedPath(hole);
    points += path.length;
    if (points > 10000)
      throw new RangeError('Geodesic point resource limit exceeded');
    const first = path[0]!;
    const minWorld = Math.ceil((west - first.longitude) / 360);
    const maxWorld = Math.floor((east - first.longitude) / 360);
    const preferred = Math.round(((west + east) / 2 - first.longitude) / 360);
    const candidates = Array.from(
      { length: Math.max(0, maxWorld - minWorld + 1) },
      (_, i) => minWorld + i,
    ).sort((a, b) => Math.abs(a - preferred) - Math.abs(b - preferred));
    const world = candidates.find((k) =>
      contains(exterior, first.longitude + 360 * k, mercatorY(first.latitude)),
    );
    if (world === undefined)
      throw new RangeError('Geodesic polygon hole is outside its exterior');
    const shift = 360 * world;
    return shift
      ? path.map((p) => ({
          latitude: p.latitude,
          longitude: p.longitude + shift,
        }))
      : path;
  });
  const result = { coordinates, holes: aligned };
  variants.set(holes, result);
  polygons.set(input, variants);
  return result;
}
