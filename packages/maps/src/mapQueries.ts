import { parseSnapshotResult } from './snapshots.ts';
import type { Camera, Coordinate, MapBounds, MapPoint } from './types';
import type { ClusterQueryKind, NativeClusterPage } from './clusterQueries';

export type MapQueryKind =
  | 'snapshot'
  | 'camera'
  | 'point'
  | 'coordinate'
  | 'bounds'
  | 'fit'
  | 'shaderLayer'
  | ClusterQueryKind;
type Result =
  | string
  | Camera
  | Coordinate
  | MapPoint
  | MapBounds
  | void
  | NativeClusterPage
  | number;
const finite = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);
export function validateMapPoint(value: unknown): MapPoint {
  const v = value as MapPoint | null;
  if (!v || !finite(v.x) || !finite(v.y))
    throw new RangeError('Map point must contain finite x and y');
  return { x: v.x, y: v.y };
}
export function validateMapCoordinate(value: unknown): Coordinate {
  const v = value as Coordinate | null;
  if (
    !v ||
    !finite(v.latitude) ||
    !finite(v.longitude) ||
    Math.abs(v.latitude) > 90 ||
    Math.abs(v.longitude) > 180
  )
    throw new RangeError('Invalid map coordinate');
  return { latitude: v.latitude, longitude: v.longitude };
}
type ClusterParser = (
  kind: ClusterQueryKind,
  json: string,
) => NativeClusterPage | number;
export function parseMapQueryResult(
  kind: MapQueryKind,
  json: string,
  clusterParser?: ClusterParser,
): Result {
  try {
    if (kind === 'snapshot') return parseSnapshotResult(json);
    if (
      kind === 'clusterChildren' ||
      kind === 'clusterLeaves' ||
      kind === 'clusterExpansion'
    ) {
      if (!clusterParser) throw new Error();
      return clusterParser(kind, json);
    }
    if (typeof json !== 'string' || json.length > 2048) throw new Error();
    const v: unknown = JSON.parse(json);
    if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error();
    const r = v as Record<string, unknown>;
    if ((kind === 'fit' || kind === 'shaderLayer') && r.accepted === true)
      return;
    if (kind === 'camera') {
      const center = r.center as Coordinate | undefined;
      if (
        center &&
        finite(center.latitude) &&
        Math.abs(center.latitude) <= 90 &&
        finite(center.longitude) &&
        finite(r.zoom) &&
        r.zoom >= 0 &&
        r.zoom <= 24 &&
        finite(r.heading) &&
        finite(r.pitch) &&
        r.pitch >= 0 &&
        r.pitch <= 90
      )
        return {
          center: { latitude: center.latitude, longitude: center.longitude },
          zoom: r.zoom,
          heading: r.heading,
          pitch: r.pitch,
        };
    }
    if (kind === 'point' && finite(r.x) && finite(r.y))
      return { x: r.x, y: r.y };
    // Preserve the SDK's unwrapped inverse longitude and bounds semantics.
    if (
      kind === 'coordinate' &&
      finite(r.latitude) &&
      Math.abs(r.latitude) <= 90 &&
      finite(r.longitude)
    )
      return { latitude: r.latitude, longitude: r.longitude };
    if (
      kind === 'bounds' &&
      finite(r.north) &&
      finite(r.south) &&
      finite(r.east) &&
      finite(r.west) &&
      r.north >= r.south &&
      r.north <= 90 &&
      r.south >= -90
    )
      return { north: r.north, south: r.south, east: r.east, west: r.west };
  } catch {
    /* Reject malformed native data with one stable error. */
  }
  throw new Error('Invalid native map query result');
}
export function createMapQueryClient(
  dispatch: (id: number, request: Record<string, string | number>) => void,
  options: {
    schedule?: (callback: () => void) => ReturnType<typeof setTimeout>;
    cancel?: (token: ReturnType<typeof setTimeout>) => void;
    parseClusterResult?: ClusterParser;
  } = {},
) {
  const schedule =
    options.schedule ?? ((callback) => setTimeout(callback, 5000));
  const cancel = options.cancel ?? clearTimeout;
  const pending = new Map<
    number,
    {
      kind: MapQueryKind;
      resolve: (value: Result) => void;
      reject: (reason: Error) => void;
      timer: ReturnType<typeof setTimeout>;
    }
  >();
  let sequence = 0;
  const take = (id: number) => {
    const item = pending.get(id);
    if (item) {
      pending.delete(id);
      cancel(item.timer);
    }
    return item;
  };
  return {
    request(
      kind: MapQueryKind,
      input: Record<string, number | string>,
      styleRevision: number,
    ): Promise<Result> {
      if (pending.size >= 32)
        return Promise.reject(new Error('Too many pending map queries'));
      if (sequence >= Number.MAX_SAFE_INTEGER)
        return Promise.reject(new Error('Map query IDs exhausted'));
      const id = ++sequence;
      return new Promise((resolve, reject) => {
        const timer = schedule(() =>
          take(id)?.reject(new Error('Map query timed out')),
        );
        pending.set(id, { kind, resolve, reject, timer });
        try {
          dispatch(id, { ...input, kind, styleRevision });
        } catch (error) {
          take(id)?.reject(
            error instanceof Error
              ? error
              : new Error('Map query dispatch failed'),
          );
        }
      });
    },
    accept(id: number, json: string, error: string) {
      const item = take(id);
      if (!item) return;
      if (error) {
        item.reject(new Error(error));
        return;
      }
      try {
        item.resolve(
          parseMapQueryResult(item.kind, json, options.parseClusterResult),
        );
      } catch (error) {
        item.reject(error as Error);
      }
    },
    cancelAll(message: string) {
      for (const id of pending.keys()) take(id)?.reject(new Error(message));
    },
  };
}
