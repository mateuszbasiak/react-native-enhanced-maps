import type { JSONValue } from './layers';
import type { ClusterHandle, ClusterPage, ClusterPageOptions } from './types';
import { utf8ByteLength } from './sceneBudget';

export type ClusterQueryKind =
  'clusterChildren' | 'clusterLeaves' | 'clusterExpansion';
export interface NativeClusterPage {
  sourceId: string;
  indexRevision: number;
  total: number;
  offset: number;
  features: {
    featureId: string;
    latitude: number;
    longitude: number;
    properties: Record<string, JSONValue>;
  }[];
}
const integer = (value: unknown, min: number, max: number): value is number =>
  typeof value === 'number' &&
  Number.isSafeInteger(value) &&
  value >= min &&
  value <= max;
const sourceID = (value: unknown): value is string =>
  typeof value === 'string' && /^[a-zA-Z0-9_.:-]{1,128}$/.test(value);
export function parseClusterQueryResult(
  kind: ClusterQueryKind,
  json: string,
): NativeClusterPage | number {
  if (json.length > 262144 || utf8ByteLength(json) > 262144)
    throw new Error('Cluster result exceeds 256KiB');
  const result: unknown = JSON.parse(json);
  if (!result || typeof result !== 'object' || Array.isArray(result))
    throw new Error('Invalid cluster result');
  const value = result as Record<string, unknown>;
  if (kind === 'clusterExpansion') {
    if (
      typeof value.zoom !== 'number' ||
      !Number.isFinite(value.zoom) ||
      value.zoom < 0 ||
      value.zoom > 25.5
    )
      throw new Error('Invalid cluster expansion zoom');
    return value.zoom;
  }
  if (
    !sourceID(value.sourceId) ||
    !integer(value.indexRevision, 1, Number.MAX_SAFE_INTEGER) ||
    !integer(value.total, 0, 10000) ||
    !integer(value.offset, 0, 10000) ||
    !Array.isArray(value.features) ||
    value.features.length > 100 ||
    value.features.length > Math.max(0, value.total - value.offset)
  )
    throw new Error('Invalid cluster page');
  let nodes = 0;
  const freezeJSON = (item: unknown, depth: number): boolean => {
    if (++nodes > 65536 || depth > 16) return false;
    if (item === null || typeof item === 'string' || typeof item === 'boolean')
      return true;
    if (typeof item === 'number') return Number.isFinite(item);
    if (typeof item !== 'object') return false;
    if (!Object.values(item).every((child) => freezeJSON(child, depth + 1)))
      return false;
    Object.freeze(item);
    return true;
  };
  for (const raw of value.features) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw))
      throw new Error('Invalid cluster feature');
    const feature = raw as Record<string, unknown>;
    if (
      typeof feature.featureId !== 'string' ||
      !feature.featureId.length ||
      feature.featureId.length > 512 ||
      typeof feature.latitude !== 'number' ||
      !Number.isFinite(feature.latitude) ||
      Math.abs(feature.latitude) > 90 ||
      typeof feature.longitude !== 'number' ||
      !Number.isFinite(feature.longitude) ||
      Math.abs(feature.longitude) > 180 ||
      !feature.properties ||
      typeof feature.properties !== 'object' ||
      Array.isArray(feature.properties) ||
      !freezeJSON(feature.properties, 0)
    )
      throw new Error('Invalid cluster feature');
  }
  return value as unknown as NativeClusterPage;
}
export function createClusterHandles() {
  const owned = new WeakMap<
    ClusterHandle,
    {
      sourceId: string;
      clusterId: number;
      pointCount: number;
      indexRevision: number;
      styleRevision: number;
    }
  >();
  const capture = (
    sourceId: string,
    featureId: string,
    properties: Readonly<Record<string, JSONValue>>,
    indexRevision: number,
    styleRevision: number,
  ): ClusterHandle | undefined => {
    if (
      properties.cluster !== true ||
      !sourceID(sourceId) ||
      !integer(properties.cluster_id, 0, 4294967295) ||
      !integer(properties.point_count, 2, 10000) ||
      featureId !== `cluster:${properties.cluster_id}` ||
      !integer(indexRevision, 1, Number.MAX_SAFE_INTEGER) ||
      !integer(styleRevision, 0, Number.MAX_SAFE_INTEGER)
    )
      return undefined;
    const handle = Object.freeze({
      sourceId,
      id: properties.cluster_id,
      pointCount: properties.point_count,
    }) as ClusterHandle;
    owned.set(handle, {
      sourceId,
      clusterId: handle.id,
      pointCount: handle.pointCount,
      indexRevision,
      styleRevision,
    });
    return handle;
  };
  return {
    capture,
    request(
      handle: ClusterHandle,
      styleRevision: number,
      page: ClusterPageOptions = {},
    ) {
      if (
        !page ||
        typeof page !== 'object' ||
        Array.isArray(page) ||
        Object.keys(page).some((key) => key !== 'limit' && key !== 'offset')
      )
        throw new RangeError('Invalid cluster page options');
      const entry =
        handle && typeof handle === 'object' ? owned.get(handle) : undefined;
      if (!entry || entry.styleRevision !== styleRevision)
        throw new Error('Cluster handle is foreign or obsolete');
      const limit = page.limit === undefined ? 100 : page.limit,
        offset = page.offset === undefined ? 0 : page.offset;
      if (!integer(limit, 1, 100) || !integer(offset, 0, 10000))
        throw new RangeError('Invalid cluster page options');
      return {
        sourceId: entry.sourceId,
        clusterId: entry.clusterId,
        indexRevision: entry.indexRevision,
        pointCount: entry.pointCount,
        limit,
        offset,
      };
    },
    page(page: NativeClusterPage, styleRevision: number): ClusterPage {
      const features = page.features.map((feature) => {
        const cluster = capture(
          page.sourceId,
          feature.featureId,
          feature.properties,
          page.indexRevision,
          styleRevision,
        );
        if (feature.properties.cluster === true && !cluster)
          throw new Error('Invalid child cluster');
        return Object.freeze({
          featureId: feature.featureId,
          coordinate: Object.freeze({
            latitude: feature.latitude,
            longitude: feature.longitude,
          }),
          properties: feature.properties,
          ...(cluster ? { cluster } : {}),
        });
      });
      return Object.freeze({
        features: Object.freeze(features),
        total: page.total,
        offset: page.offset,
      });
    },
  };
}
