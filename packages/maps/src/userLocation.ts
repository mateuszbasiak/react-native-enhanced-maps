/** Application-owned fix. Timestamp is Unix milliseconds; heading is degrees [0,360). */
export interface UserLocation {
  readonly latitude: number;
  readonly longitude: number;
  readonly accuracy?: number;
  readonly altitude?: number;
  readonly heading?: number;
  readonly speed?: number;
  readonly timestamp?: number;
}
export interface UserLocationChangeEvent {
  readonly nativeEvent: { readonly coordinate: UserLocation };
}
export function normalizeUserLocation(value: unknown): UserLocation {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new TypeError('userLocation must be a location fix');
  const v = value as Record<string, unknown>;
  if (
    typeof v.latitude !== 'number' ||
    !Number.isFinite(v.latitude) ||
    Math.abs(v.latitude) > 90 ||
    typeof v.longitude !== 'number' ||
    !Number.isFinite(v.longitude) ||
    Math.abs(v.longitude) > 180
  )
    throw new RangeError('Invalid user location coordinate');
  const result: Record<string, number> = {
    latitude: v.latitude,
    longitude: v.longitude,
  };
  for (const name of [
    'accuracy',
    'altitude',
    'heading',
    'speed',
    'timestamp',
  ] as const) {
    const measurement = v[name];
    if (measurement === undefined) continue;
    if (
      typeof measurement !== 'number' ||
      !Number.isFinite(measurement) ||
      (name !== 'altitude' && measurement < 0) ||
      (name === 'heading' && measurement >= 360)
    )
      throw new RangeError(`Invalid user location ${name}`);
    result[name] = measurement;
  }
  return result as unknown as UserLocation;
}
export function parseUserLocationEvent(
  value: unknown,
  revision: number,
): UserLocationChangeEvent | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const e = value as {
    styleRevision?: unknown;
    locationJSON?: unknown;
    error?: unknown;
  };
  if (
    e.styleRevision !== revision ||
    (e.error !== undefined && e.error !== '') ||
    typeof e.locationJSON !== 'string' ||
    e.locationJSON.length > 4096
  )
    return null;
  try {
    return {
      nativeEvent: {
        coordinate: normalizeUserLocation(JSON.parse(e.locationJSON)),
      },
    };
  } catch {
    return null;
  }
}
