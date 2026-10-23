import { Children, Fragment, isValidElement } from 'react';
import type { ElementType, ReactElement, ReactNode } from 'react';
import type { MarkerProps } from './Marker';
import type { GeoJSONData } from './layers';
import type { ClusterMember } from './types';

export const markerSourceID = 'em-marker-clusters';
export const markerLayerID = 'em-marker-clusters-layout';
export const clusterMarkerPrefix = 'em-cluster:';

export function collectMarkers(children: ReactNode, markerType: ElementType) {
  const markers = new Map<string, ReactElement<MarkerProps>>();
  const ids = new Set<string>();
  const content: ReactNode[] = [];
  const features: GeoJSONData['features'][number][] = [];
  const visit = (nodes: ReactNode, depth = 0) => {
    if (depth > 32) throw new Error('Map child nesting limit exceeded');
    Children.forEach(nodes, (node) => {
      if (isValidElement(node) && node.type === Fragment) {
        visit((node.props as { children?: ReactNode }).children, depth + 1);
      } else if (
        isValidElement<MarkerProps>(node) &&
        node.type === markerType
      ) {
        const p = node.props;
        if (
          typeof p.id !== 'string' ||
          !p.id ||
          p.id.length > 512 ||
          p.id.startsWith(clusterMarkerPrefix)
        )
          throw new Error(
            'Marker requires a stable id outside the em-cluster: namespace',
          );
        if (ids.has(p.id)) throw new Error('Duplicate marker id');
        ids.add(p.id);
        if (p.cluster !== undefined && typeof p.cluster !== 'boolean')
          throw new TypeError('Marker cluster must be a boolean');
        if (
          !p.coordinate ||
          !Number.isFinite(p.coordinate.latitude) ||
          !Number.isFinite(p.coordinate.longitude) ||
          Math.abs(p.coordinate.latitude) > 90 ||
          Math.abs(p.coordinate.longitude) > 180
        )
          throw new RangeError('Invalid marker coordinate');
        if (p.cluster) {
          if (Math.abs(p.coordinate.latitude) > 85)
            throw new RangeError(
              'Clustered markers require latitude within ±85 degrees',
            );
          if (markers.size >= 10000)
            throw new RangeError('Clustered marker limit exceeded');
          markers.set(p.id, node);
          features.push({
            type: 'Feature',
            id: p.id,
            properties: {},
            geometry: {
              type: 'Point',
              coordinates: [p.coordinate.longitude, p.coordinate.latitude],
            },
          });
        } else content.push(node);
      } else content.push(node);
    });
  };
  visit(children);
  const data: GeoJSONData = { type: 'FeatureCollection', features };
  return { markers, content, data, signature: JSON.stringify(data) };
}

export interface MarkerLayoutFeature {
  readonly id: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly clusterId?: number;
  readonly count?: number;
}
export interface MarkerLayout {
  readonly sourceRevision: number;
  readonly indexRevision: number;
  readonly features: readonly MarkerLayoutFeature[];
}
export function parseMarkerLayout(
  json: string,
  revision: number,
): MarkerLayout | undefined {
  try {
    if (json.length > 4 * 1024 * 1024) return;
    const value = JSON.parse(json) as MarkerLayout;
    if (
      !value ||
      value.sourceRevision !== revision ||
      !Number.isSafeInteger(value.indexRevision) ||
      value.indexRevision < 1 ||
      !Array.isArray(value.features) ||
      value.features.length > 10000
    )
      return;
    const ids = new Set<string>();
    for (const feature of value.features) {
      if (
        !feature ||
        typeof feature.id !== 'string' ||
        !feature.id ||
        feature.id.length > 512 ||
        ids.has(feature.id) ||
        !Number.isFinite(feature.latitude) ||
        Math.abs(feature.latitude) > 90 ||
        !Number.isFinite(feature.longitude) ||
        Math.abs(feature.longitude) > 180
      )
        return;
      ids.add(feature.id);
      if (feature.clusterId !== undefined) {
        if (
          !Number.isSafeInteger(feature.clusterId) ||
          feature.clusterId < 0 ||
          feature.clusterId > 4294967295 ||
          !Number.isSafeInteger(feature.count) ||
          feature.count! < 2 ||
          feature.count! > 10000 ||
          feature.id !== `${clusterMarkerPrefix}${feature.clusterId}`
        )
          return;
      } else if (
        feature.count !== undefined ||
        feature.id.startsWith(clusterMarkerPrefix)
      )
        return;
    }
    return value;
  } catch {
    return;
  }
}

export async function resolveClusterMembers(
  count: number,
  markers: ReadonlyMap<string, ReactElement<MarkerProps>>,
  fetch: (offset: number) => Promise<readonly string[]>,
  current: () => boolean,
): Promise<readonly ClusterMember[]> {
  const members: ClusterMember[] = [];
  const seen = new Set<string>();
  for (let offset = 0; offset < count; offset += 100) {
    if (!current()) throw new Error('Cluster is obsolete');
    const ids = await fetch(offset);
    if (!current()) throw new Error('Cluster is obsolete');
    if (ids.length !== Math.min(100, count - offset))
      throw new Error('Incomplete cluster membership');
    for (const id of ids) {
      if (seen.has(id)) throw new Error('Duplicate cluster member');
      seen.add(id);
      const marker = markers.get(id);
      if (!marker) throw new Error('Cluster member is obsolete');
      members.push(
        Object.freeze({
          id,
          coordinate: Object.freeze({ ...marker.props.coordinate }),
          data: marker.props.data,
        }),
      );
    }
  }
  return Object.freeze(members);
}
