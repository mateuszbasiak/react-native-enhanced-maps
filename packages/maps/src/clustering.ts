import type { GeoJSONData } from './layers';

export interface ClusterOptions {
  /** Radius in SDK tile units; 512 is one tile width. Default 50. */
  readonly radius?: number;
  /** Last integer zoom with clustering; 0–17. Default 14. */
  readonly maxZoom?: number;
  /** Minimum original points per cluster; 2–10000. Default 2. */
  readonly minPoints?: number;
}
export function normalizeClusterOptions(
  value: unknown,
): Readonly<Required<ClusterOptions>> | undefined {
  if (value === undefined || value === false) return undefined;
  if (
    value !== true &&
    (!value ||
      typeof value !== 'object' ||
      Array.isArray(value) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(value)))
  )
    throw new TypeError('cluster must be a boolean or options object');
  const options = value === true ? {} : (value as Record<string, unknown>);
  if (
    Object.keys(options).some(
      (key) => !['radius', 'maxZoom', 'minPoints'].includes(key),
    )
  )
    throw new TypeError('Unknown cluster option');
  const result = {
    radius: options.radius === undefined ? 50 : options.radius,
    maxZoom: options.maxZoom === undefined ? 14 : options.maxZoom,
    minPoints: options.minPoints === undefined ? 2 : options.minPoints,
  };
  for (const [key, min, max] of [
    ['radius', 1, 512],
    ['maxZoom', 0, 17],
    ['minPoints', 2, 10000],
  ] as const) {
    const number = result[key];
    if (
      typeof number !== 'number' ||
      !Number.isInteger(number) ||
      number < min ||
      number > max
    )
      throw new RangeError(`Invalid cluster ${key}`);
  }
  return Object.freeze(result as Required<ClusterOptions>);
}
export function validateClusterData(data: GeoJSONData): void {
  for (const feature of data.features) {
    if (feature.id.startsWith('cluster:'))
      throw new TypeError('Clustered input IDs must not start with cluster:');
    if (feature.geometry.type !== 'Point')
      throw new TypeError('Clustered sources require Point features');
    if (
      [
        'cluster',
        'cluster_id',
        'point_count',
        'point_count_abbreviated',
        '__enhanced_maps_cluster_index',
      ].some(
        (key) => feature.properties && Object.hasOwn(feature.properties, key),
      )
    )
      throw new TypeError(
        'Clustered input contains reserved cluster properties',
      );
  }
}
