export interface MarkerCoordinate {
  readonly latitude: number;
  readonly longitude: number;
}
export function markerPosition(coordinate: MarkerCoordinate): [number, number] {
  if (
    !Number.isFinite(coordinate.latitude) ||
    Math.abs(coordinate.latitude) > 90 ||
    !Number.isFinite(coordinate.longitude) ||
    Math.abs(coordinate.longitude) > 180
  )
    throw new RangeError(
      'Marker coordinate is outside valid latitude/longitude bounds',
    );
  return [coordinate.longitude, coordinate.latitude];
}
