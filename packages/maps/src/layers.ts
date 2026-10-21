import { Children, Fragment, isValidElement } from 'react';
import type { ReactNode } from 'react';

export type GeoJSONPosition = readonly [longitude: number, latitude: number];
export type GeoJSONGeometry =
  | { readonly type: 'Point'; readonly coordinates: GeoJSONPosition }
  | {
      readonly type: 'MultiPoint' | 'LineString';
      readonly coordinates: readonly GeoJSONPosition[];
    }
  | {
      readonly type: 'MultiLineString' | 'Polygon';
      readonly coordinates: readonly (readonly GeoJSONPosition[])[];
    }
  | {
      readonly type: 'MultiPolygon';
      readonly coordinates: readonly (readonly (readonly GeoJSONPosition[])[])[];
    };
export type JSONValue =
  | null
  | boolean
  | number
  | string
  | readonly JSONValue[]
  | { readonly [key: string]: JSONValue };
export interface GeoJSONFeature {
  readonly type: 'Feature';
  readonly id: string;
  readonly properties: Readonly<Record<string, JSONValue>> | null;
  readonly geometry: GeoJSONGeometry;
}
export interface GeoJSONData {
  readonly type: 'FeatureCollection';
  readonly features: readonly GeoJSONFeature[];
}
export interface GeoJSONSourceProps {
  readonly id: string;
  /** Increase on every immutable data replacement. */
  readonly revision: number;
  readonly data: GeoJSONData;
  readonly children?: ReactNode;
}
export interface LineStyle {
  readonly lineCap?: 'butt' | 'round' | 'square';
  readonly lineJoin?: 'miter' | 'round' | 'bevel';
  readonly lineMiterLimit?: number;
  readonly lineDasharray?: readonly number[];
  readonly lineColor?: string;
  readonly lineWidth?: number;
  readonly lineOpacity?: number;
}
export interface FillStyle {
  readonly fillColor?: string;
  readonly fillOpacity?: number;
}
interface LayerProps {
  readonly id: string;
  readonly source?: string;
  readonly visible?: boolean;
}
export interface LineLayerProps extends LayerProps {
  readonly style: LineStyle;
}
export interface FillLayerProps extends LayerProps {
  readonly style: FillStyle;
}

/** Declarative map content; MapView consumes these elements without mounting React views. */
export function GeoJSONSource(_props: GeoJSONSourceProps): ReactNode {
  throw new Error(
    'GeoJSONSource must be a direct MapView child or inside a Fragment',
  );
}
export function LineLayer(_props: LineLayerProps): ReactNode {
  throw new Error('LineLayer must be inside MapView or GeoJSONSource');
}
export function FillLayer(_props: FillLayerProps): ReactNode {
  throw new Error('FillLayer must be inside MapView or GeoJSONSource');
}
export interface SourceDefinition {
  readonly id: string;
  readonly type: 'geojson';
  readonly revision: number;
  readonly data: GeoJSONData;
}
export type LayerDefinition =
  | {
      readonly id: string;
      readonly source: string;
      readonly type: 'line';
      readonly visible: boolean;
      readonly style: LineStyle & {
        readonly lineColor: string;
        readonly lineWidth: number;
        readonly lineOpacity: number;
      };
    }
  | {
      readonly id: string;
      readonly source: string;
      readonly type: 'fill';
      readonly visible: boolean;
      readonly style: Required<FillStyle>;
    };
export interface LayerScene {
  readonly sources: readonly SourceDefinition[];
  readonly layers: readonly LayerDefinition[];
}

function id(value: unknown): asserts value is string {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_.:-]{1,128}$/.test(value))
    throw new Error(
      'Map content ID must contain 1–128 letters, digits, _, ., :, or -',
    );
}
const validatedData = new WeakMap<object, number>();
const normalizedData = new WeakMap<object, GeoJSONData>();
function validateData(data: GeoJSONData): number {
  if (!data || typeof data !== 'object')
    throw new Error('Expected GeoJSON FeatureCollection');
  const cached = validatedData.get(data);
  if (cached !== undefined) return cached;
  if (
    data.type !== 'FeatureCollection' ||
    !Array.isArray(data.features) ||
    data.features.length > 10000
  )
    throw new Error(
      'Expected GeoJSON FeatureCollection with at most 10000 features',
    );
  let positions = 0;
  const position = (p: GeoJSONPosition) => {
    if (
      !Array.isArray(p) ||
      p.length !== 2 ||
      !p.every(Number.isFinite) ||
      Math.abs(p[0]!) > 180 ||
      Math.abs(p[1]!) > 90
    )
      throw new Error('GeoJSON position must be finite [longitude, latitude]');
    if (++positions > 50000) throw new Error('GeoJSON position limit exceeded');
  };
  const line = (points: readonly GeoJSONPosition[], ring = false) => {
    if (!Array.isArray(points) || points.length < (ring ? 4 : 2))
      throw new Error('Invalid GeoJSON line or ring');
    points.forEach(position);
    if (
      ring &&
      (points[0]![0] !== points.at(-1)![0] ||
        points[0]![1] !== points.at(-1)![1])
    )
      throw new Error('GeoJSON polygon rings must be closed');
  };
  const polygon = (rings: readonly (readonly GeoJSONPosition[])[]) => {
    if (!Array.isArray(rings) || !rings.length)
      throw new Error('GeoJSON polygon needs an exterior ring');
    rings.forEach((ring) => line(ring, true));
  };
  let propertyNodes = 0;
  let propertyCharacters = 0;
  const json = (value: unknown, depth = 0): void => {
    if (++propertyNodes > 65536)
      throw new Error('Feature property node limit exceeded');
    if (typeof value === 'string') propertyCharacters += value.length;
    if (propertyCharacters > 1024 * 1024)
      throw new Error('Feature property size limit exceeded');
    if (depth > 16) throw new Error('Feature properties exceed nesting limit');
    if (
      value === null ||
      typeof value === 'string' ||
      typeof value === 'boolean'
    )
      return;
    if (typeof value === 'number' && Number.isFinite(value)) return;
    if (typeof value === 'object' && value) {
      if (
        !Array.isArray(value) &&
        Object.getPrototypeOf(value) !== Object.prototype &&
        Object.getPrototypeOf(value) !== null
      )
        throw new Error('Feature properties must contain plain JSON objects');
      for (const [key, entry] of Object.entries(value)) {
        propertyCharacters += key.length;
        json(entry, depth + 1);
      }
      return;
    }
    throw new Error('Feature properties must contain finite JSON values');
  };
  const ids = new Set<string>();
  for (const feature of data.features) {
    if (!feature || feature.type !== 'Feature')
      throw new Error('Expected GeoJSON Feature');
    id(feature.id);
    if (ids.has(feature.id)) throw new Error('Duplicate feature ID');
    ids.add(feature.id);
    if (
      feature.properties !== null &&
      (!feature.properties ||
        Array.isArray(feature.properties) ||
        typeof feature.properties !== 'object')
    )
      throw new Error('Feature properties must be an object or null');
    json(feature.properties);
    const g = feature.geometry;
    switch (g?.type) {
      case 'Point':
        position(g.coordinates);
        break;
      case 'MultiPoint':
        if (!Array.isArray(g.coordinates))
          throw new Error('Invalid MultiPoint');
        g.coordinates.forEach(position);
        break;
      case 'LineString':
        line(g.coordinates);
        break;
      case 'MultiLineString':
        if (!Array.isArray(g.coordinates))
          throw new Error('Invalid MultiLineString');
        g.coordinates.forEach((points: readonly GeoJSONPosition[]) =>
          line(points),
        );
        break;
      case 'Polygon':
        polygon(g.coordinates);
        break;
      case 'MultiPolygon':
        if (!Array.isArray(g.coordinates))
          throw new Error('Invalid MultiPolygon');
        g.coordinates.forEach(polygon);
        break;
      default:
        throw new Error('Unsupported GeoJSON geometry');
    }
  }
  const normalized: GeoJSONData = {
    type: 'FeatureCollection',
    features: data.features.map((feature) => ({
      type: 'Feature',
      id: feature.id,
      properties: feature.properties,
      geometry: {
        type: feature.geometry.type,
        coordinates: feature.geometry.coordinates,
      } as GeoJSONGeometry,
    })),
  };
  if (JSON.stringify(normalized).length > 4 * 1024 * 1024)
    throw new Error('GeoJSON source exceeds 4 MiB');
  normalizedData.set(data, normalized);
  validatedData.set(data, positions);
  normalizedData.set(normalized, normalized);
  validatedData.set(normalized, positions);
  return positions;
}
function color(value: unknown, fallback: string): string {
  if (value === undefined) return fallback;
  if (
    typeof value !== 'string' ||
    !/^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(value)
  )
    throw new Error('Layer colors must be #RRGGBB or #RRGGBBAA');
  return value;
}
function number(value: unknown, fallback: number, max: number): number {
  if (value === undefined) return fallback;
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value < 0 ||
    value > max
  )
    throw new Error('Layer style number out of range');
  return value;
}
export function compileLayers(children: ReactNode): LayerScene {
  const sources: SourceDefinition[] = [];
  const layers: LayerDefinition[] = [];
  const sourceIds = new Set<string>();
  const layerIds = new Set<string>();
  let positions = 0;
  const visit = (nodes: ReactNode, parent?: string, depth = 0): void => {
    if (depth > 32) throw new Error('Map content nesting limit exceeded');
    Children.forEach(nodes, (node) => {
      if (node === null || node === undefined || typeof node === 'boolean')
        return;
      if (!isValidElement(node)) throw new Error('Unsupported MapView child');
      if (node.type === Fragment) {
        visit(
          (node.props as { children?: ReactNode }).children,
          parent,
          depth + 1,
        );
        return;
      }
      if (node.type === GeoJSONSource) {
        if (parent) throw new Error('Sources cannot be nested');
        const p = node.props as GeoJSONSourceProps;
        if (
          Object.keys(p).some(
            (key) => !['id', 'revision', 'data', 'children'].includes(key),
          )
        )
          throw new Error('Unsupported source option');
        id(p.id);
        if (sourceIds.has(p.id)) throw new Error('Duplicate source ID');
        sourceIds.add(p.id);
        if (!Number.isSafeInteger(p.revision) || p.revision < 0)
          throw new Error(
            'Source revision must be a non-negative safe integer',
          );
        positions += validateData(p.data);
        if (positions > 50000) throw new Error('Scene position limit exceeded');
        sources.push({
          id: p.id,
          type: 'geojson',
          revision: p.revision,
          data: normalizedData.get(p.data)!,
        });
        visit(p.children, p.id, depth + 1);
        return;
      }
      if (node.type !== LineLayer && node.type !== FillLayer)
        throw new Error('Unsupported MapView child');
      const p = node.props as LineLayerProps & FillLayerProps;
      if (
        Object.keys(p).some(
          (key) => !['id', 'source', 'style', 'visible'].includes(key),
        )
      )
        throw new Error('Unsupported layer option');
      id(p.id);
      if (layerIds.has(p.id)) throw new Error('Duplicate layer ID');
      layerIds.add(p.id);
      const source = p.source ?? parent;
      id(source);
      if (parent && source !== parent)
        throw new Error('Nested layer source must match its parent');
      if (p.visible !== undefined && typeof p.visible !== 'boolean')
        throw new Error('Layer visibility must be boolean');
      if (!p.style || typeof p.style !== 'object' || Array.isArray(p.style))
        throw new Error('Layer style must be an object');
      const type = node.type === LineLayer ? 'line' : 'fill';
      const allowed =
        type === 'line'
          ? ['lineColor', 'lineWidth', 'lineOpacity']
          : ['fillColor', 'fillOpacity'];
      if (Object.keys(p.style).some((key) => !allowed.includes(key)))
        throw new Error('Unsupported layer style property');
      if (type === 'line')
        layers.push({
          id: p.id,
          source,
          type,
          visible: p.visible ?? true,
          style: {
            lineColor: color(p.style.lineColor, '#0088ff'),
            lineWidth: number(p.style.lineWidth, 2, 256),
            lineOpacity: number(p.style.lineOpacity, 1, 1),
          },
        });
      else
        layers.push({
          id: p.id,
          source,
          type,
          visible: p.visible ?? true,
          style: {
            fillColor: color(p.style.fillColor, '#0088ff'),
            fillOpacity: number(p.style.fillOpacity, 1, 1),
          },
        });
    });
  };
  visit(children);
  if (sources.length > 64 || layers.length > 64)
    throw new Error('Scene supports at most 64 sources and 64 layers');
  let renderedPositions = 0;
  for (const layer of layers) {
    const source = sources.find((item) => item.id === layer.source);
    if (!source) throw new Error('Layer references a missing source');
    renderedPositions += validateData(source.data);
    if (renderedPositions > 100000)
      throw new Error('Rendered scene position limit exceeded');
  }
  return { sources, layers };
}

/** Keep native source props stable when only styles or parent state change. Data is immutable. */
export function reuseLayerScene(
  previous: LayerScene,
  next: LayerScene,
): LayerScene {
  for (const source of next.sources) {
    const old = previous.sources.find((item) => item.id === source.id);
    if (
      old &&
      (source.revision < old.revision ||
        (source.revision === old.revision && source.data !== old.data))
    )
      throw new Error('Source data replacement requires an increased revision');
  }
  const sources =
    previous.sources.length === next.sources.length &&
    next.sources.every((s, i) => {
      const old = previous.sources[i]!;
      return (
        s.id === old.id && s.revision === old.revision && s.data === old.data
      );
    })
      ? previous.sources
      : next.sources;
  const layers =
    JSON.stringify(previous.layers) === JSON.stringify(next.layers)
      ? previous.layers
      : next.layers;
  return { sources, layers };
}

export function serializeSources(sources: LayerScene['sources']): string {
  const encoded = JSON.stringify(sources);
  if (encoded.length > 4 * 1024 * 1024)
    throw new Error('Combined GeoJSON sources exceed 4 MiB');
  return encoded;
}
