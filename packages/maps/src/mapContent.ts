import { Children, Fragment, isValidElement } from 'react';
import normalizeColor from '@react-native/normalize-colors';
import type { ReactNode } from 'react';
import type { Coordinate } from './types';
import { geodesicPathInfo, geodesicPolygon } from './geodesic.ts';
import { polylineGradient } from './polylineGradient.ts';
import type { GradientStops } from './polylineGradient';

export interface ShapePressEvent {
  readonly nativeEvent: {
    readonly identifier: string;
    readonly coordinate: Coordinate;
    readonly position: { readonly x: number; readonly y: number };
  };
}
interface ContentProps {
  readonly id?: string;
  readonly zIndex?: number;
  readonly visible?: boolean;
  readonly opacity?: number;
  readonly tappable?: boolean;
  readonly onPress?: (event: ShapePressEvent) => void;
  readonly lineCap?: 'butt' | 'round' | 'square';
  readonly lineJoin?: 'miter' | 'round' | 'bevel';
  readonly miterLimit?: number;
  readonly lineDashPattern?: readonly number[];
}
export interface PolylineProps extends ContentProps {
  /** One color per original coordinate; overrides strokeColor. Incompatible with dash patterns. */
  readonly strokeColors?: readonly string[];
  readonly geodesic?: boolean;
  readonly coordinates: readonly Coordinate[];
  readonly strokeColor?: string;
  readonly strokeWidth?: number;
}
export interface PolygonProps extends Omit<PolylineProps, 'strokeColors'> {
  readonly holes?: readonly (readonly Coordinate[])[];
  readonly fillColor?: string;
}
export interface CircleProps extends Omit<
  PolygonProps,
  'coordinates' | 'holes' | 'geodesic'
> {
  readonly center: Coordinate;
  readonly radius: number;
}
export function Circle(_props: CircleProps): ReactNode {
  throw new Error('Circle must be a MapView child');
}
/** Standalone content descriptors consumed by MapView, without a native view per element. */
export function Polyline(_props: PolylineProps): ReactNode {
  throw new Error('Polyline must be a MapView child');
}
export function Polygon(_props: PolygonProps): ReactNode {
  throw new Error('Polygon must be a MapView child');
}
interface BaseItem {
  readonly id: string;
  readonly zIndex: number;
  readonly visible: boolean;
  readonly opacity: number;
  readonly tappable: boolean;
  readonly lineCap: 'butt' | 'round' | 'square';
  readonly lineJoin: 'miter' | 'round' | 'bevel';
  readonly miterLimit: number;
  readonly lineDashPattern: readonly number[] | undefined;
}
export type RenderItem =
  | (BaseItem & {
      readonly type: 'polyline';
      readonly strokeGradient: GradientStops | undefined;
      readonly coordinates: readonly Coordinate[];
      readonly strokeColor: string;
      readonly strokeWidth: number;
    })
  | (BaseItem & {
      readonly type: 'polygon';
      readonly coordinates: readonly Coordinate[];
      readonly holes: readonly (readonly Coordinate[])[];
      readonly strokeColor: string;
      readonly strokeWidth: number;
      readonly fillColor: string;
    });
export interface RenderScene {
  readonly version: 1;
  readonly items: readonly RenderItem[];
}
const coordinatesCache = new WeakMap<object, readonly Coordinate[]>();
const ringCache = new WeakMap<object, readonly Coordinate[]>();
const holesCache = new WeakMap<object, readonly (readonly Coordinate[])[]>();
const noHoles: readonly (readonly Coordinate[])[] = [];
const gradientColors = new WeakMap<readonly string[], readonly string[]>();
function number(
  value: unknown,
  min: number,
  max: number,
  fallback?: number,
): number {
  if (value === undefined && fallback !== undefined) return fallback;
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value < min ||
    value > max
  )
    throw new RangeError('Map content number is outside its supported range');
  return value;
}
function boolean(value: unknown, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  if (typeof value !== 'boolean')
    throw new TypeError('Map content flag must be boolean');
  return value;
}
function color(value: unknown, fallback: string): string {
  if (value === undefined) return fallback;
  if (typeof value !== 'string' || value.length > 256)
    throw new Error(
      'Shape colors must be supported React Native color strings',
    );
  // Preserve existing long hex strings and their scene signatures.
  if (/^#[a-fA-F0-9]{6}([a-fA-F0-9]{2})?$/.test(value)) return value;
  const rgba = normalizeColor(value);
  if (rgba === null)
    throw new Error(
      'Shape colors must be supported React Native color strings',
    );
  return '#' + rgba.toString(16).padStart(8, '0');
}

function strokeColors(
  value: unknown,
  count: number,
): readonly string[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length !== count)
    throw new Error('strokeColors requires one color per input coordinate');
  const cached = gradientColors.get(value);
  if (cached) return cached;
  const colors = Array.from({ length: count }, (_, i) => {
    if (typeof value[i] !== 'string')
      throw new TypeError('Gradient colors must be strings');
    return color(value[i], '#0088ff');
  });
  gradientColors.set(value, colors);
  return colors;
}
function coordinate(value: Coordinate): Coordinate {
  if (!value || typeof value !== 'object')
    throw new Error('Expected a coordinate');
  return {
    latitude: number(value.latitude, -85, 85),
    longitude: number(value.longitude, -180, 180),
  };
}
function coordinates(
  values: readonly Coordinate[],
  ring = false,
): readonly Coordinate[] {
  if (
    !Array.isArray(values) ||
    values.length < (ring ? 3 : 2) ||
    values.length > 10000
  )
    throw new Error('Invalid coordinate count');
  const cache = ring ? ringCache : coordinatesCache;
  const cached = cache.get(values);
  if (cached) return cached;
  const result = values.map(coordinate);
  if (ring) {
    if (new Set(result.map((p) => `${p.latitude},${p.longitude}`)).size < 3)
      throw new Error('A polygon ring needs three distinct coordinates');
    const first = result[0]!,
      last = result.at(-1)!;
    if (first.latitude !== last.latitude || first.longitude !== last.longitude)
      result.push(first);
  }
  cache.set(values, result);
  return result;
}
function holes(
  values?: readonly (readonly Coordinate[])[],
): readonly (readonly Coordinate[])[] {
  if (values === undefined) return noHoles;
  if (!Array.isArray(values) || values.length > 128)
    throw new Error('Invalid polygon holes');
  const cached = holesCache.get(values);
  if (cached) return cached;
  const result = values.map((ring) => coordinates(ring, true));
  holesCache.set(values, result);
  return result;
}
function choice<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T,
): T {
  if (value === undefined) return fallback;
  if (!allowed.includes(value as T)) throw new Error('Unsupported line style');
  return value as T;
}
function dashPattern(
  value: readonly number[] | undefined,
): readonly number[] | undefined {
  if (value === undefined) return undefined;
  if (
    !Array.isArray(value) ||
    value.length < 2 ||
    value.length > 32 ||
    value.length % 2 !== 0 ||
    value.some(
      (v) =>
        typeof v !== 'number' || !Number.isFinite(v) || v <= 0 || v > 10000,
    )
  )
    throw new Error('Dash pattern requires an even number of positive lengths');
  return value;
}
function circleRing(center: Coordinate, radius: number): readonly Coordinate[] {
  const c = coordinate(center);
  number(radius, 0, 1000000);
  if (radius === 0) return [];
  const radians = Math.PI / 180,
    latitude = c.latitude * radians,
    longitude = c.longitude * radians,
    distance = radius / 6371008.8;
  if (Math.abs(c.latitude) + distance / radians > 85)
    throw new RangeError('Circle exceeds supported latitude');
  const points = Array.from({ length: 128 }, (_, i) => {
    const bearing = (i * 2 * Math.PI) / 128;
    const lat = Math.asin(
      Math.sin(latitude) * Math.cos(distance) +
        Math.cos(latitude) * Math.sin(distance) * Math.cos(bearing),
    );
    const lon =
      longitude +
      Math.atan2(
        Math.sin(bearing) * Math.sin(distance) * Math.cos(latitude),
        Math.cos(distance) - Math.sin(latitude) * Math.sin(lat),
      );
    return { latitude: lat / radians, longitude: lon / radians };
  });
  points.push(points[0]!);
  return points;
}
export function compileMapContent(children: ReactNode): RenderScene {
  const items: RenderItem[] = [];
  const ids = new Set<string>();
  let totalPoints = 0;
  const visit = (nodes: ReactNode, depth = 0): void => {
    if (depth > 32) throw new Error('Map content nesting limit exceeded');
    Children.forEach(nodes, (node) => {
      if (node === null || node === undefined || typeof node === 'boolean')
        return;
      if (!isValidElement(node)) throw new Error('Unsupported MapView child');
      if (node.type === Fragment) {
        visit((node.props as { children?: ReactNode }).children, depth + 1);
        return;
      }
      if (![Polyline, Polygon, Circle].includes(node.type as typeof Polyline))
        throw new Error('Unsupported MapView child');
      const p = node.props as PolylineProps & PolygonProps & CircleProps;
      const id = p.id ?? `shape:${items.length}`;
      if (typeof id !== 'string' || !/^[a-zA-Z0-9_.:-]{1,128}$/.test(id))
        throw new Error(
          'Content requires a stable ID with 1–128 letters, digits, _, ., :, or -',
        );
      if (ids.has(id)) throw new Error('Duplicate map content ID');
      ids.add(id);
      const common = {
        id,
        zIndex: number(p.zIndex, -1e6, 1e6, 0),
        visible: boolean(p.visible, true),
        opacity: number(p.opacity, 0, 1, 1),
        tappable: boolean(p.tappable, false),
        lineCap: choice(p.lineCap, ['butt', 'round', 'square'], 'round'),
        lineJoin: choice(p.lineJoin, ['miter', 'round', 'bevel'], 'round'),
        miterLimit: number(p.miterLimit, 0, 1000, 10),
        lineDashPattern: dashPattern(p.lineDashPattern),
      };
      const allowed = [
        'id',
        'zIndex',
        'visible',
        'opacity',
        'tappable',
        'onPress',
        'lineCap',
        'lineJoin',
        'miterLimit',
        'lineDashPattern',
      ];
      if (
        node.type === Polyline ||
        node.type === Polygon ||
        node.type === Circle
      ) {
        const ring = node.type !== Polyline;
        const geodesic =
          node.type === Circle ? false : boolean(p.geodesic, false);
        if (node.type !== Circle) allowed.push('geodesic');
        let c =
          node.type === Circle
            ? circleRing(p.center, p.radius)
            : coordinates(p.coordinates, ring);
        const colors =
          node.type === Polyline
            ? strokeColors(p.strokeColors, c.length)
            : undefined;
        if (node.type === Polyline) allowed.push('strokeColors');
        if (colors && common.lineDashPattern)
          throw new Error('Gradient strokes cannot use a dash pattern');
        let vertexIndices: readonly number[] | undefined;
        let h = node.type === Polygon ? holes(p.holes) : noHoles;
        if (geodesic) {
          if (ring) {
            const polygon = geodesicPolygon(c, h);
            c = polygon.coordinates;
            h = polygon.holes;
          } else {
            const path = geodesicPathInfo(c);
            c = path.coordinates;
            vertexIndices = path.vertexIndices;
          }
        }
        totalPoints += c.length;
        const strokeColor = color(p.strokeColor, '#0088ff'),
          strokeWidth = number(p.strokeWidth, 0, 256, 2);
        allowed.push(
          'strokeColor',
          'strokeWidth',
          ...(node.type === Circle ? ['center', 'radius'] : ['coordinates']),
        );
        if (ring) {
          allowed.push('fillColor', ...(node.type === Circle ? [] : ['holes']));
          totalPoints += h.reduce((sum, r) => sum + r.length, 0);
          items.push({
            ...common,
            type: 'polygon',
            coordinates: c,
            holes: h,
            strokeColor,
            strokeWidth,
            fillColor: color(p.fillColor, '#0088ff40'),
          });
        } else
          items.push({
            ...common,
            type: 'polyline',
            strokeGradient: colors
              ? polylineGradient(c, colors, vertexIndices)
              : undefined,
            coordinates: c,
            strokeColor,
            strokeWidth,
          });
      }
      if (p.onPress !== undefined && typeof p.onPress !== 'function')
        throw new TypeError('onPress must be a function');
      if (Object.keys(p).some((key) => !allowed.includes(key)))
        throw new Error('Unsupported map component prop');
      if (items.length > 64 || totalPoints > 10000)
        throw new Error('Map content resource limit exceeded');
    });
  };
  visit(children);
  items.sort((a, b) => a.zIndex - b.zIndex);
  return { version: 1, items };
}
/** Preserve prop payloads across unrelated parent renders. All data arrays are immutable. */
export function reuseMapContent(
  previous: RenderScene,
  next: RenderScene,
): RenderScene {
  const byId = new Map(previous.items.map((item) => [item.id, item]));
  const items = next.items.map((item) => {
    const old = byId.get(item.id);
    return old &&
      Object.keys(item).every(
        (key) => Reflect.get(old, key) === Reflect.get(item, key),
      )
      ? old
      : item;
  });
  return previous.items.length === items.length &&
    items.every((item, i) => item === previous.items[i])
    ? previous
    : { version: 1, items };
}
export function serializeMapContent(scene: RenderScene): string {
  const text = JSON.stringify(scene);
  if (text.length > 2 * 1024 * 1024)
    throw new Error('Map content exceeds 2 MiB');
  return text;
}
