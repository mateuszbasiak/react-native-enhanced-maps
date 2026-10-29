import type { ReactNode } from 'react';
import normalizeColor from '@react-native/normalize-colors';
import type { GeoJSONData } from './layers';
export interface WeightedLatLng {
  readonly latitude: number;
  readonly longitude: number;
  readonly weight?: number;
}
export interface HeatmapGradient {
  readonly colors: readonly string[];
  readonly startPoints: readonly number[];
  readonly colorMapSize?: number;
}
export interface HeatmapProps {
  readonly points: readonly WeightedLatLng[];
  readonly radius?: number;
  readonly opacity?: number;
  readonly gradient?: HeatmapGradient;
}
export function Heatmap(_props: HeatmapProps): ReactNode {
  throw new Error('Heatmap must be a MapView child');
}
function number(value: unknown, min: number, max: number): number {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value < min ||
    value > max
  )
    throw new RangeError('Invalid Heatmap number');
  return value;
}
const defaults: HeatmapGradient = {
  colors: ['#00000000', '#00ff00', '#ff0000'],
  startPoints: [0, 0.2, 1],
};
export function normalizeHeatmap(props: HeatmapProps) {
  if (
    Object.keys(props).some(
      (key) => !['points', 'radius', 'opacity', 'gradient'].includes(key),
    )
  )
    throw new Error('Unsupported Heatmap prop');
  const radius = number(props.radius ?? 20, 10, 50),
    opacity = number(props.opacity ?? 0.7, 0, 1);
  if (!Array.isArray(props.points))
    throw new Error('Heatmap points must be an array');
  const data: GeoJSONData = {
    type: 'FeatureCollection',
    features: Array.from(props.points, (point, i) => {
      if (!point || typeof point !== 'object')
        throw new Error('Invalid Heatmap point');
      const lat = number(point.latitude, -85, 85),
        lon = number(point.longitude, -180, 180),
        weight = number(point.weight ?? 1, 0, 1000000);
      return {
        type: 'Feature',
        id: String(i),
        properties: { weight },
        geometry: { type: 'Point', coordinates: [lon, lat] },
      };
    }),
  };
  const gradient = props.gradient ?? defaults;
  if (
    !gradient ||
    Object.keys(gradient).some(
      (k) => !['colors', 'startPoints', 'colorMapSize'].includes(k),
    ) ||
    !Array.isArray(gradient.colors) ||
    !Array.isArray(gradient.startPoints) ||
    gradient.colors.length < 1 ||
    gradient.colors.length > 256 ||
    gradient.colors.length !== gradient.startPoints.length
  )
    throw new Error('Invalid Heatmap gradient');
  const size = number(gradient.colorMapSize ?? 256, 2, 1024);
  if (!Number.isInteger(size))
    throw new Error('Heatmap colorMapSize must be an integer');
  let previous = -1;
  const stops = Array.from(gradient.colors, (color, i) => {
    const offset = number(gradient.startPoints[i], 0, 1);
    if (offset <= previous || typeof color !== 'string' || color.length > 256)
      throw new Error('Invalid Heatmap gradient stop');
    const rgba = normalizeColor(color);
    if (rgba === null) throw new Error('Invalid Heatmap gradient color');
    previous = offset;
    return {
      offset,
      channels: [
        rgba >>> 24,
        (rgba >>> 16) & 255,
        (rgba >>> 8) & 255,
        rgba & 255,
      ],
    };
  });
  if (stops[0]!.offset > 0)
    stops.unshift({
      offset: 0,
      channels: [...stops[0]!.channels.slice(0, 3), 0],
    });
  if (stops.at(-1)!.offset < 1)
    stops.push({ offset: 1, channels: stops.at(-1)!.channels });
  let segment = 0;
  const colors = Array.from({ length: size }, (_, i) => {
    const offset = i / (size - 1);
    while (
      segment + 1 < stops.length - 1 &&
      stops[segment + 1]!.offset < offset
    )
      segment++;
    const a = stops[segment]!,
      b = stops[segment + 1] ?? a;
    const t = a === b ? 0 : (offset - a.offset) / (b.offset - a.offset);
    return [
      offset,
      '#' +
        a.channels
          .map((n, c) =>
            Math.round(n + (b.channels[c]! - n) * t)
              .toString(16)
              .padStart(2, '0'),
          )
          .join(''),
    ] as const;
  });
  return {
    data,
    style: {
      heatmapRadius: radius,
      heatmapOpacity: opacity,
      heatmapGradient: colors,
    },
  };
}
