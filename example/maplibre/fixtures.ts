import type {
  GeoJSONData,
  GeoJSONFeature,
  GeoJSONPosition,
} from '../../packages/maps/src/layers';

export const center: [number, number] = [18.66, 54.37];
export const route: GeoJSONFeature & {
  geometry: { type: 'LineString'; coordinates: readonly GeoJSONPosition[] };
} = {
  type: 'Feature',
  id: 'route',
  properties: {},
  geometry: {
    type: 'LineString',
    coordinates: [
      [18.61, 54.34],
      [18.65, 54.35],
      [18.66, 54.37],
      [18.68, 54.39],
      [18.72, 54.41],
    ],
  },
};

/** Stable prefixes let count changes keep the same existing vessel identities. */
export function createFleet(count: number): GeoJSONData {
  if (!Number.isInteger(count) || count < 1 || count > 10000)
    throw new RangeError('Fleet size must be 1–10000');
  return {
    type: 'FeatureCollection',
    features: Array.from({ length: count }, (_, i) => ({
      type: 'Feature',
      id: `vessel-${i}`,
      properties: { heading: (i * 137.508) % 360 },
      geometry: {
        type: 'Point',
        coordinates: [
          center[0] + (((i * 0.61803398875) % 1) - 0.5) * 0.16,
          center[1] + (((i * 0.41421356237) % 1) - 0.5) * 0.1,
        ],
      },
    })),
  };
}
