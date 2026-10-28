import { Children, Fragment, isValidElement, createElement } from 'react';
import type { ReactNode } from 'react';
import { Polyline, Polygon, Circle, compileMapContent } from './mapContent';
import { nativeShapes } from './nativeShapes';
import { serializeMapScene } from './sceneBudget';
import { compileLayers, GeoJSONSource as CheckedSource } from './layers';
import type { ShapePressEvent } from './mapContent';
import type { GeoJSONData } from './layers';
import type { MapFeaturePressEvent } from './types';
import { normalizeClusterOptions, validateClusterData } from './clustering';
import type { ClusterOptions } from './clustering';
import { UrlTile, normalizeUrlTile } from './UrlTile';
import type { UrlTileProps } from './UrlTile';
export interface SourceProps {
  readonly id: string;
  readonly data: GeoJSONData;
  /** Optional producer version. Increase for data changes; omit for unversioned replacement. */
  readonly revision?: number;
  readonly cluster?: boolean | ClusterOptions;
  readonly children?: ReactNode;
  readonly onPress?: (featureId: string) => void;
  readonly onFeaturePress?: (event: MapFeaturePressEvent) => void;
}
export interface LayerStyle {
  readonly circleColor?: string;
  readonly circleRadius?: number;
  readonly circleOpacity?: number;
  readonly lineColor?: string;
  readonly lineWidth?: number;
  readonly lineOpacity?: number;
  readonly fillColor?: string;
  readonly fillOpacity?: number;
}
export interface InternalLayerProps {
  readonly id: string;
  readonly source?: string;
  readonly type: 'circle' | 'line' | 'fill';
  readonly beforeId?: string;
  readonly visible?: boolean;
  readonly style?: LayerStyle;
  readonly clusterFilter?: 'clusters' | 'points';
}
export function InternalSource(_props: SourceProps): ReactNode {
  throw new Error('InternalSource must be a direct MapView child');
}
export function InternalLayer(_props: InternalLayerProps): ReactNode {
  throw new Error('Layer must be inside MapView or InternalSource');
}
const identifier = (value: unknown) => {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_.:-]{1,128}$/.test(value))
    throw new Error('Invalid map content id');
  return value;
};
const numericStyles: Record<string, number> = {
  circleRadius: 256,
  lineWidth: 256,
  circleOpacity: 1,
  lineOpacity: 1,
  fillOpacity: 1,
};
export function compileScene(children: ReactNode) {
  const sources: (
      | {
          id: string;
          data: GeoJSONData;
          revision?: number;
          lineMetrics?: boolean;
          coordinateSpace?: 'unwrapped';
          cluster?: Readonly<Required<ClusterOptions>>;
        }
      | {
          id: string;
          type: 'raster';
          urlTemplate: string;
          tileSize: number;
          minZoom: number;
          maxZoom: number;
          cluster?: never;
        }
    )[] = [],
    layers: Record<string, unknown>[] = [],
    live: ReactNode[] = [],
    shapes: ReactNode[] = [];
  const contentLayers: Record<string, unknown>[] = [];
  const contentOrder = new Map<string, { zIndex: number; index: number }>();
  let tileIndex = 0,
    contentIndex = 0;
  type Tap = Omit<ShapePressEvent['nativeEvent'], 'identifier'>;
  const presses = new Map<string, (featureId: string, event: Tap) => void>();
  const featurePresses = new Map<
    string,
    (event: MapFeaturePressEvent) => void
  >();
  const visit = (nodes: ReactNode, source?: string, depth = 0) => {
    if (depth > 32) throw new Error('Map child nesting limit exceeded');
    Children.forEach(nodes, (node) => {
      if (node == null || typeof node === 'boolean') return;
      if (!isValidElement(node)) throw new Error('Unsupported MapView child');
      if (node.type === Fragment) {
        visit(
          (node.props as { children?: ReactNode }).children,
          source,
          depth + 1,
        );
        return;
      }
      if (node.type === UrlTile) {
        if (source) throw new Error('UrlTile must be a MapView child');
        const p = node.props as UrlTileProps;
        const id = identifier(p.id ?? `url-tile:${tileIndex++}`);
        const value = normalizeUrlTile(p);
        const { opacity, visible, zIndex, ...raster } = value;
        sources.push({ id, type: 'raster', ...raster });
        contentOrder.set(id, { zIndex, index: contentIndex++ });
        contentLayers.push({
          id: `raster:${id}`,
          source: id,
          type: 'raster',
          visible,
          interactive: false,
          style: { rasterOpacity: opacity },
        });
        return;
      }
      if (node.type === InternalSource) {
        const p = node.props as SourceProps;
        identifier(p.id);
        // Reuse the bounded GeoJSON validation and immutable normalization contract.
        const scene = compileLayers(
          createElement(CheckedSource, {
            id: p.id,
            revision: p.revision ?? 0,
            data: p.data,
          }),
        );
        const cluster = normalizeClusterOptions(p.cluster);
        if (cluster) validateClusterData(scene.sources[0]!.data);
        sources.push({
          id: p.id,
          data: scene.sources[0]!.data,
          ...(p.revision === undefined ? {} : { revision: p.revision }),
          ...(cluster ? { cluster } : {}),
        });
        if (p.onPress) presses.set(p.id, p.onPress);
        if (p.onFeaturePress) featurePresses.set(p.id, p.onFeaturePress);
        visit(p.children, p.id, depth + 1);
        return;
      }
      if (node.type === InternalLayer) {
        const p = node.props as InternalLayerProps;
        identifier(p.id);
        const sid = p.source ?? source;
        identifier(sid);
        if (!['circle', 'line', 'fill'].includes(p.type))
          throw new Error('Unsupported layer type');
        if (p.beforeId !== undefined) identifier(p.beforeId);
        if (
          p.clusterFilter !== undefined &&
          !['clusters', 'points'].includes(p.clusterFilter)
        )
          throw new TypeError('Invalid cluster filter');
        const style = p.style ?? {};
        const allowed = new Set(
          p.type === 'circle'
            ? ['circleColor', 'circleRadius', 'circleOpacity']
            : p.type === 'line'
              ? ['lineColor', 'lineWidth', 'lineOpacity']
              : ['fillColor', 'fillOpacity'],
        );
        for (const [key, value] of Object.entries(style)) {
          if (!allowed.has(key))
            throw new Error(`Unsupported ${p.type} style: ${key}`);
          if (key.endsWith('Color')) {
            if (
              typeof value !== 'string' ||
              !/^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(value)
            )
              throw new Error('Layer color must be #RRGGBB or #RRGGBBAA');
          } else if (
            typeof value !== 'number' ||
            !Number.isFinite(value) ||
            value < 0 ||
            value > numericStyles[key]!
          )
            throw new RangeError('Invalid layer style number');
        }
        layers.push({
          id: p.id,
          source: sid,
          type: p.type,
          beforeId: p.beforeId,
          style,
          visible: p.visible ?? true,
          ...(p.clusterFilter ? { clusterFilter: p.clusterFilter } : {}),
          interactive: presses.has(sid!),
        });
        return;
      }
      if (
        node.type === Polyline ||
        node.type === Polygon ||
        node.type === Circle
      ) {
        const p = node.props as { id?: string; zIndex?: number };
        contentOrder.set(p.id ?? `shape:${shapes.length}`, {
          zIndex: p.zIndex ?? 0,
          index: contentIndex++,
        });
        shapes.push(node);
        return;
      }
      if (source)
        throw new Error('Only Layer elements may be nested in InternalSource');
      live.push(node);
    });
  };
  visit(children);
  if (shapes.length) {
    const content = compileMapContent(shapes);
    shapes.forEach((node, index) => {
      const p = (
        node as import('react').ReactElement<
          import('./mapContent').PolylineProps
        >
      ).props;
      const id = p.id ?? `shape:${index}`;
      if (p.tappable && p.onPress)
        presses.set(id, (_feature, event) =>
          p.onPress!({ nativeEvent: { ...event, identifier: id } }),
        );
    });
    const scene = nativeShapes(content, { sources: [], layers: [] });
    for (const s of scene.sources)
      sources.push({
        id: s.id,
        data: s.data,
        ...(s.coordinateSpace ? { coordinateSpace: s.coordinateSpace } : {}),
        ...(s.lineMetrics ? { lineMetrics: true } : {}),
      });
    contentLayers.push(...scene.layers);
  }
  contentLayers.sort((a, b) => {
    const left = contentOrder.get(a.source as string)!;
    const right = contentOrder.get(b.source as string)!;
    return left.zIndex - right.zIndex || left.index - right.index;
  });
  layers.push(...contentLayers);
  const sourceIds = new Set<string>(),
    layerIds = new Set<string>();
  for (const s of sources) {
    if (sourceIds.has(s.id)) throw new Error('Duplicate source id');
    sourceIds.add(s.id);
  }
  for (const l of layers) {
    l.interactive =
      presses.has(l.source as string) || featurePresses.has(l.source as string);
    if (layerIds.has(l.id as string)) throw new Error('Duplicate layer id');
    layerIds.add(l.id as string);
    if (!sourceIds.has(l.source as string))
      throw new Error('Layer references missing source');
    if (
      l.clusterFilter &&
      !sources.find((source) => source.id === l.source)?.cluster
    )
      throw new Error('Cluster filters require a clustered source');
  }
  if (sources.length > 64 || layers.length > 128)
    throw new Error('Map scene resource limit exceeded');
  return {
    json: serializeMapScene(sources, layers),
    live,
    presses,
    featurePresses,
  };
}
