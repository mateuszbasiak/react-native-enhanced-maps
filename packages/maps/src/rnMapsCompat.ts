import { fitRequest } from './cameraFit.ts';
import type {
  Camera,
  Coordinate,
  Region,
  MapBounds,
  FitOptions,
  FitToOptions,
  CameraAnimationOptions,
} from './types';
const wrap = (longitude: number) =>
  ((((longitude + 180) % 360) + 360) % 360) - 180;
export function regionCoordinates(region: Region): readonly Coordinate[] {
  if (
    !region ||
    ![
      region.latitude,
      region.longitude,
      region.latitudeDelta,
      region.longitudeDelta,
    ].every(Number.isFinite) ||
    Math.abs(region.latitude) > 90 ||
    Math.abs(region.longitude) > 180 ||
    region.latitudeDelta <= 0 ||
    region.latitudeDelta > 180 ||
    region.longitudeDelta <= 0 ||
    region.longitudeDelta >= 360 ||
    Math.abs(region.latitude) + region.latitudeDelta / 2 > 90
  )
    throw new RangeError('Invalid map region');
  return [
    {
      latitude: region.latitude - region.latitudeDelta / 2,
      longitude: wrap(region.longitude - region.longitudeDelta / 2),
    },
    {
      latitude: region.latitude + region.latitudeDelta / 2,
      longitude: wrap(region.longitude + region.longitudeDelta / 2),
    },
  ];
}
export function regionFromBounds(bounds: MapBounds): Region {
  const delta =
    bounds.east >= bounds.west
      ? bounds.east - bounds.west
      : bounds.east + 360 - bounds.west;
  return {
    latitude: (bounds.north + bounds.south) / 2,
    longitude: wrap(bounds.west + delta / 2),
    latitudeDelta: bounds.north - bounds.south,
    longitudeDelta: delta,
  };
}
export function mergeCamera(current: Camera, patch: Partial<Camera>): Camera {
  if (
    Object.keys(patch).some(
      (key) => !['center', 'zoom', 'heading', 'pitch'].includes(key),
    )
  )
    throw new Error(
      'Camera supports center, zoom, heading and pitch; altitude is not supported',
    );
  const camera = { ...current, ...patch };
  if (
    !camera.center ||
    ![
      camera.center.latitude,
      camera.center.longitude,
      camera.zoom,
      camera.heading,
      camera.pitch,
    ].every(Number.isFinite) ||
    Math.abs(camera.center.latitude) > 90 ||
    Math.abs(camera.center.longitude) > 180 ||
    camera.zoom < 0 ||
    camera.zoom > 24 ||
    camera.pitch < 0 ||
    camera.pitch > 90
  )
    throw new RangeError('Invalid camera');
  return camera;
}
export function cameraDuration(
  options?: number | CameraAnimationOptions,
): number {
  const duration =
    typeof options === 'number' ? options : (options?.duration ?? 300);
  if (!Number.isFinite(duration) || duration < 0 || duration > 60000)
    throw new RangeError('Camera duration must be between 0 and 60000ms');
  return duration;
}
export function fitOptions(options: FitToOptions = {}): FitOptions {
  return {
    padding: options.edgePadding ?? 0,
    durationMs: options.animated === false ? 0 : 300,
  };
}

export function parseRegionEvent(value: unknown, revision: number) {
  const e = value as
    | (Region & {
        isGesture: boolean;
        complete: boolean;
        styleRevision: number;
      })
    | null;
  if (
    !e ||
    e.styleRevision !== revision ||
    typeof e.isGesture !== 'boolean' ||
    typeof e.complete !== 'boolean' ||
    ![e.latitude, e.longitude, e.latitudeDelta, e.longitudeDelta].every(
      Number.isFinite,
    ) ||
    Math.abs(e.latitude) > 90 ||
    Math.abs(e.longitude) > 180 ||
    e.latitudeDelta < 0 ||
    e.latitudeDelta > 180 ||
    e.longitudeDelta < 0 ||
    e.longitudeDelta > 360
  )
    return null;
  return {
    region: {
      latitude: e.latitude,
      longitude: e.longitude,
      latitudeDelta: e.latitudeDelta,
      longitudeDelta: e.longitudeDelta,
    },
    details: { isGesture: e.isGesture },
    complete: e.complete,
  };
}

export function regionRequest(region: Region, duration = 300) {
  return {
    ...fitRequest(regionCoordinates(region), {
      durationMs: cameraDuration(duration),
    }),
    regionLongitude: region.longitude,
    regionLongitudeDelta: region.longitudeDelta,
  };
}

/** Keep read/merge/dispatch atomic with respect to other camera commands. */
export function createCameraCommandQueue() {
  let tail = Promise.resolve();
  return (
    run: () => Promise<void>,
    current: () => boolean = () => true,
  ): Promise<void> => {
    const task = tail.then(() => (current() ? run() : undefined));
    tail = task.catch(() => {});
    return task;
  };
}

/** Reject known migration hazards instead of silently accepting inert props. */
export function rejectUnsupportedProps(
  input: object,
  component: 'MapView' | 'Marker',
) {
  const names =
    component === 'MapView'
      ? ['provider', 'mapType', 'customMapStyle', 'googleMapId']
      : ['flat', 'rotation', 'tracksViewChanges'];
  for (const name of names)
    if (Reflect.get(input, name) !== undefined)
      throw new Error(
        `${component}.${name} is not supported; see the RN Maps migration guide`,
      );
}
