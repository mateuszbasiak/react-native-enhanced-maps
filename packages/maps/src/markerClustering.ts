import { Children, Fragment, isValidElement, cloneElement } from 'react';
import type { ElementType, ReactElement, ReactNode } from 'react';
import type { MarkerProps } from './Marker';
import type { GeoJSONData } from './layers';
import type { ClusterMember } from './types';

import { Geojson, expandGeojson, geojsonScope } from './geojson.ts';
import type { GeojsonProps } from './geojson';

export const markerSourceID = 'em-marker-clusters';
export const markerLayerID = 'em-marker-clusters-layout';
export const clusterMarkerPrefix = 'em-cluster:';

export function collectMarkers(children: ReactNode, markerType: ElementType) {
  const markers = new Map<string, ReactElement<MarkerProps>>();
  const ids = new Set<string>();
  const content: ReactNode[] = [];
  const features: GeoJSONData['features'][number][] = [];
  const grouped = new Map<
    string | undefined,
    GeoJSONData['features'][number][]
  >();
  const visit = (nodes: ReactNode, depth = 0, path = '') => {
    if (depth > 32) throw new Error('Map child nesting limit exceeded');
    Children.toArray(nodes).forEach((node, index) => {
      const childPath = `${path}/${encodeURIComponent(isValidElement(node) ? String(node.key ?? index) : String(index))}`;
      if (isValidElement<GeojsonProps>(node) && node.type === Geojson) {
        visit(
          expandGeojson(node.props, markerType, geojsonScope(childPath)),
          depth + 1,
          childPath,
        );
      } else if (isValidElement(node) && node.type === Fragment) {
        visit(
          (node.props as { children?: ReactNode }).children,
          depth + 1,
          childPath,
        );
      } else if (
        isValidElement<MarkerProps>(node) &&
        node.type === markerType
      ) {
        const id =
          node.props.id ?? node.props.identifier ?? `em-auto:${childPath}`;
        const normalized =
          node.props.id === id ? node : cloneElement(node, { id });
        const p = normalized.props as MarkerProps & { id: string };
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
          p.clusterGroup !== undefined &&
          (typeof p.clusterGroup !== 'string' ||
            !p.clusterGroup.trim() ||
            p.clusterGroup.length > 512)
        )
          throw new TypeError(
            'Marker clusterGroup must be a non-empty string of at most 512 characters',
          );
        if (
          !p.coordinate ||
          !Number.isFinite(p.coordinate.latitude) ||
          !Number.isFinite(p.coordinate.longitude) ||
          Math.abs(p.coordinate.latitude) > 90 ||
          Math.abs(p.coordinate.longitude) > 180
        )
          throw new RangeError('Invalid marker coordinate');
        if (p.draggable && (p.cluster ?? p.clusterGroup !== undefined))
          throw new Error(
            'Draggable markers must opt out of clustering with cluster={false}',
          );
        if (p.cluster ?? p.clusterGroup !== undefined) {
          if (Math.abs(p.coordinate.latitude) > 85)
            throw new RangeError(
              'Clustered markers require latitude within ±85 degrees',
            );
          markers.set(p.id, normalized);
          const feature: GeoJSONData['features'][number] = {
            type: 'Feature',
            id: p.id,
            properties: {},
            geometry: {
              type: 'Point',
              coordinates: [p.coordinate.longitude, p.coordinate.latitude],
            },
          };
          features.push(feature);
          const group = grouped.get(p.clusterGroup) ?? [];
          group.push(feature);
          grouped.set(p.clusterGroup, group);
        } else content.push(normalized);
      } else content.push(node);
    });
  };
  visit(children);
  const data: GeoJSONData = { type: 'FeatureCollection', features };
  const keys: (string | undefined)[] = [...grouped.keys()]
    .filter((key): key is string => key !== undefined)
    .sort();
  if (grouped.has(undefined)) keys.unshift(undefined);
  let groupIndex = 0;
  const groups = keys.map((clusterGroup) => {
    const suffix = clusterGroup === undefined ? '' : `:${++groupIndex}`;
    const data: GeoJSONData = {
      type: 'FeatureCollection',
      features: grouped.get(clusterGroup)!,
    };
    return {
      clusterGroup,
      sourceId: markerSourceID + suffix,
      layerId: markerLayerID + suffix,
      data,
      markers: new Map(
        data.features.map((feature) => [feature.id, markers.get(feature.id)!]),
      ),
    };
  });
  return {
    markers,
    content,
    data,
    groups,
    signature: JSON.stringify(
      groups.map(({ clusterGroup, data }) => ({ clusterGroup, data })),
    ),
  };
}

export interface MarkerLayoutFeature {
  readonly id: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly sourceId?: string;
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
    const value = JSON.parse(json) as MarkerLayout;
    if (
      !value ||
      value.sourceRevision !== revision ||
      !Number.isSafeInteger(value.indexRevision) ||
      value.indexRevision < 1 ||
      !Array.isArray(value.features)
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
      const sourceId = feature.sourceId ?? markerSourceID;
      if (
        sourceId !== markerSourceID &&
        (typeof sourceId !== 'string' ||
          !/^em-marker-clusters:[1-9][0-9]*$/.test(sourceId) ||
          !Number.isSafeInteger(
            Number(sourceId.slice(markerSourceID.length + 1)),
          ))
      )
        return;
      const suffix = sourceId.slice(markerSourceID.length);
      if (feature.clusterId !== undefined) {
        if (
          !Number.isSafeInteger(feature.clusterId) ||
          feature.clusterId < 0 ||
          feature.clusterId > 4294967295 ||
          !Number.isSafeInteger(feature.count) ||
          feature.count! < 2 ||
          feature.id !==
            `${clusterMarkerPrefix}${suffix ? suffix.slice(1) + ':' : ''}${feature.clusterId}`
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
