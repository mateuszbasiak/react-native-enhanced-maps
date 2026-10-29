import { createElement } from 'react';
import type { ElementType, ReactElement, ReactNode } from 'react';
import normalizeColor from '@react-native/normalize-colors';
import { Polyline, Polygon, compileMapContent } from './mapContent.ts';
import type { PolylineProps, PolygonProps } from './mapContent';
import type { MarkerProps } from './Marker';
import type { Coordinate } from './types';

export interface GeojsonFeature {
  readonly type: 'Feature';
  readonly id?: string | number;
  readonly properties: Readonly<Record<string, unknown>> | null;
  readonly geometry: {
    readonly type: string;
    readonly coordinates?: unknown;
  } | null;
}
export interface GeojsonData {
  readonly type: 'FeatureCollection';
  readonly features: readonly GeojsonFeature[];
}
export interface GeojsonPressEvent {
  readonly type: 'point' | 'polyline' | 'polygon';
  readonly feature: GeojsonFeature;
  readonly coordinates: Coordinate | readonly Coordinate[];
  readonly holes?: readonly (readonly Coordinate[])[];
}
export interface GeojsonProps {
  readonly geojson: GeojsonData;
  readonly strokeColor?: string;
  readonly fillColor?: string;
  readonly strokeWidth?: number;
  readonly color?: MarkerProps['pinColor'];
  readonly image?: MarkerProps['image'];
  readonly markerComponent?: ReactNode;
  readonly title?: string;
  readonly anchor?: MarkerProps['anchor'];
  readonly centerOffset?: MarkerProps['centerOffset'];
  /** React markers update directly; this upstream snapshot hint has no effect. */
  readonly tracksViewChanges?: boolean;
  readonly tappable?: boolean;
  readonly zIndex?: number;
  readonly lineCap?: PolylineProps['lineCap'];
  readonly lineJoin?: PolylineProps['lineJoin'];
  readonly miterLimit?: number;
  readonly lineDashPattern?: readonly number[];
  /** Only zero is supported, matching the existing shape limitation. */
  readonly lineDashPhase?: number;
  readonly onPress?: (event: GeojsonPressEvent) => void;
}
export function Geojson(_props: GeojsonProps): ReactNode {
  throw new Error('Geojson must be a MapView child');
}
function defined<T extends object>(
  value: T,
): { [K in keyof T]: Exclude<T[K], undefined> } {
  return Object.fromEntries(
    Object.entries(value).filter(([, v]) => v !== undefined),
  ) as { [K in keyof T]: Exclude<T[K], undefined> };
}
const allowed = new Set([
  'geojson',
  'strokeColor',
  'fillColor',
  'strokeWidth',
  'color',
  'image',
  'markerComponent',
  'title',
  'anchor',
  'centerOffset',
  'tracksViewChanges',
  'tappable',
  'zIndex',
  'lineCap',
  'lineJoin',
  'miterLimit',
  'lineDashPattern',
  'lineDashPhase',
  'onPress',
]);

/** Bounded compatibility expansion, called before MapView collects markers. */
export function expandGeojson(
  props: GeojsonProps,
  markerType: ElementType,
  scope: string,
): ReactElement[] {
  if (Object.keys(props).some((key) => !allowed.has(key)))
    throw new Error('Unsupported Geojson prop');
  if (props.lineDashPhase !== undefined && props.lineDashPhase !== 0)
    throw new Error('Nonzero lineDashPhase is unsupported');
  if (props.onPress !== undefined && typeof props.onPress !== 'function')
    throw new TypeError('Geojson onPress must be a function');
  for (const flag of [props.tracksViewChanges, props.tappable])
    if (flag !== undefined && typeof flag !== 'boolean')
      throw new TypeError('Geojson flags must be boolean');
  const data = props.geojson;
  if (
    !data ||
    data.type !== 'FeatureCollection' ||
    !Array.isArray(data.features)
  )
    throw new Error('Invalid Geojson FeatureCollection');
  let values = 0,
    characters = 0;
  const json = (value: unknown, depth = 0): void => {
    if (++values > 100000 || depth > 16)
      throw new Error('Geojson property complexity limit exceeded');
    if (typeof value === 'string') {
      characters += value.length;
      if (characters > 1048576)
        throw new Error('Geojson property size limit exceeded');
      return;
    }
    if (
      value === null ||
      typeof value === 'boolean' ||
      (typeof value === 'number' && Number.isFinite(value))
    )
      return;
    if (Array.isArray(value)) {
      if (value.length > 100000 - values)
        throw new Error('Geojson property complexity limit exceeded');
      for (let i = 0; i < value.length; i++) json(value[i], depth + 1);
      return;
    }
    if (typeof value === 'object' && value) {
      if (
        !Array.isArray(value) &&
        Object.getPrototypeOf(value) !== Object.prototype &&
        Object.getPrototypeOf(value) !== null
      )
        throw new Error('Geojson properties require plain JSON');
      for (const key of Object.keys(value)) {
        json(key, depth + 1);
        json(Reflect.get(value, key), depth + 1);
      }
      return;
    }
    throw new Error('Invalid Geojson property');
  };
  const coordinate = (value: unknown): Coordinate => {
    if (
      !Array.isArray(value) ||
      value.length < 2 ||
      value.length > 3 ||
      !Array.from(value).every(
        (v) => typeof v === 'number' && Number.isFinite(v),
      ) ||
      Math.abs(value[0]) > 180 ||
      Math.abs(value[1]) > 85
    )
      throw new Error('Invalid Geojson coordinate');
    return { latitude: value[1], longitude: value[0] };
  };
  const array = (value: unknown): unknown[] => {
    if (!Array.isArray(value)) throw new Error('Invalid Geojson geometry');
    for (let i = 0; i < value.length; i++)
      if (!(i in value)) throw new Error('Sparse Geojson geometry');
    return value;
  };
  const line = (value: unknown, ring = false) => {
    const points = array(value);
    if (points.length < (ring ? 3 : 2))
      throw new Error('Invalid Geojson line/ring coordinate count');
    return points.map(coordinate);
  };
  const color = (
    feature: GeojsonFeature,
    key: string,
    fallback: string | undefined,
  ) => {
    const properties = feature.properties;
    const value = properties?.[key] ?? fallback;
    if (value === undefined) return undefined;
    if (typeof value !== 'string' || value.length > 256)
      throw new Error('Invalid Geojson color');
    const normalized = normalizeColor(value);
    if (normalized === null) throw new Error('Invalid Geojson color');
    const opacity = properties?.[`${key}-opacity`];
    if (opacity === undefined) return value;
    if (
      typeof opacity !== 'number' ||
      !Number.isFinite(opacity) ||
      opacity < 0 ||
      opacity > 1
    )
      throw new Error('Invalid Geojson opacity');
    return (
      '#' +
      (
        ((normalized >>> 8) * 256 +
          Math.round((normalized & 255) * opacity)) >>>
        0
      )
        .toString(16)
        .padStart(8, '0')
    );
  };
  const result: ReactElement[] = [];
  for (const [index, feature] of Array.from(data.features).entries()) {
    if (
      !feature ||
      feature.type !== 'Feature' ||
      !feature.geometry ||
      (feature.properties !== null &&
        (typeof feature.properties !== 'object' ||
          Array.isArray(feature.properties)))
    )
      throw new Error('Invalid Geojson feature');
    values = 0;
    characters = 0;
    json(feature.properties);
    const geometry = feature.geometry;
    const emit = (
      type: GeojsonPressEvent['type'],
      coordinates: Coordinate | readonly Coordinate[],
      holes?: readonly (readonly Coordinate[])[],
    ) => {
      const key = `geojson:${scope}:${index}:${result.length}`;
      const event: GeojsonPressEvent = {
        type,
        feature,
        coordinates,
        ...(holes?.length ? { holes } : {}),
      };
      const onPress = props.onPress ? () => props.onPress!(event) : undefined;
      if (type === 'point') {
        const tracking =
          feature.properties?.tracksViewChanges ?? props.tracksViewChanges;
        if (tracking !== undefined && typeof tracking !== 'boolean')
          throw new TypeError('Geojson tracking must be boolean');
        result.push(
          createElement(
            markerType,
            {
              key,
              id: key,
              coordinate: coordinates,
              pinColor: feature.properties?.['marker-color'] ?? props.color,
              image: props.image,
              title: props.title,
              anchor: props.anchor,
              centerOffset: props.centerOffset,
              zIndex: props.zIndex,
              onPress,
            },
            props.markerComponent,
          ),
        );
      } else {
        const common = defined({
          id: key,
          coordinates: coordinates as readonly Coordinate[],
          strokeColor: color(feature, 'stroke', props.strokeColor),
          strokeWidth: (feature.properties?.['stroke-width'] ??
            props.strokeWidth) as number | undefined,
          zIndex: props.zIndex,
          tappable: props.tappable,
          onPress,
          lineCap: props.lineCap,
          lineJoin: props.lineJoin,
          miterLimit: props.miterLimit,
          lineDashPattern: props.lineDashPattern,
        });
        result.push(
          type === 'polygon'
            ? createElement(Polygon, {
                ...common,
                key,
                holes,
                fillColor: color(feature, 'fill', props.fillColor),
              } as PolygonProps)
            : createElement(Polyline, { ...common, key }),
        );
      }
    };
    const polygon = (value: unknown) => {
      const rings = array(value).map((ring) => line(ring, true));
      if (!rings.length) throw new Error('Invalid Geojson polygon');
      emit('polygon', rings[0]!, rings.slice(1));
    };
    switch (geometry.type) {
      case 'Point':
        emit('point', coordinate(geometry.coordinates));
        break;
      case 'MultiPoint':
        for (const p of array(geometry.coordinates))
          emit('point', coordinate(p));
        break;
      case 'LineString':
        emit('polyline', line(geometry.coordinates));
        break;
      case 'MultiLineString':
        for (const l of array(geometry.coordinates)) emit('polyline', line(l));
        break;
      case 'Polygon':
        polygon(geometry.coordinates);
        break;
      case 'MultiPolygon':
        for (const p of array(geometry.coordinates)) polygon(p);
        break;
      default:
        throw new Error('Unsupported Geojson geometry');
    }
  }
  // Reuse the actual shape validator, including generated ring and shared output budgets.
  compileMapContent(result.filter((node) => node.type !== markerType));
  return result;
}

/** Compact map-local scope; full React paths can exceed the native shape-ID limit. */
export function geojsonScope(path: string): string {
  let hash = 2166136261;
  for (let i = 0; i < path.length; i++)
    hash = Math.imul(hash ^ path.charCodeAt(i), 16777619);
  return (hash >>> 0).toString(36);
}
