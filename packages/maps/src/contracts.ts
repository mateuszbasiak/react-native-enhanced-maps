import type { Camera, MapError, MapPlatform, MapProvider } from './types';

export function resolveProvider(platform: MapPlatform, provider?: MapProvider): MapProvider {
  if (platform !== 'ios' && platform !== 'android') throw new Error('Unsupported map platform');
  if (provider !== undefined && provider !== 'apple' && provider !== 'google') throw new Error('Unsupported map provider');
  const resolved = provider ?? (platform === 'ios' ? 'apple' : 'google');
  if (platform === 'android' && resolved === 'apple') {
    throw new Error('Apple Maps is not supported on Android');
  }
  return resolved;
}

export function validateCamera(camera: Camera): Camera {
  const { latitude, longitude } = camera.center;
  for (const [name, value] of Object.entries({ latitude, longitude, zoom: camera.zoom, heading: camera.heading, pitch: camera.pitch })) {
    if (!Number.isFinite(value)) throw new RangeError(`${name} must be finite`);
  }
  if (Math.abs(latitude) > 90) throw new RangeError('latitude must be between -90 and 90');
  if (Math.abs(longitude) > 180) throw new RangeError('longitude must be between -180 and 180');
  if (camera.zoom < 0 || camera.zoom > 24) throw new RangeError('zoom must be between 0 and 24');
  if (camera.pitch < 0 || camera.pitch > 90) throw new RangeError('pitch must be between 0 and 90');
  return camera;
}

/** JS-side stale-work guard. Native adapters must independently guard native jobs. */
export function createRevisionGate() {
  let revision = 0;
  let disposed = false;
  return {
    advance(): number {
      if (disposed) throw new Error('Map resource is disposed');
      return ++revision;
    },
    isCurrent(candidate: number): boolean { return !disposed && revision > 0 && candidate === revision; },
    dispose(): void { disposed = true; },
  };
}

/** Tile/content failure does not destroy an already initialized map. */
export function classifyMapError(error: { readonly code: string; readonly message: string }): MapError {
  return { ...error, fatal: error.code !== 'map-load' };
}
