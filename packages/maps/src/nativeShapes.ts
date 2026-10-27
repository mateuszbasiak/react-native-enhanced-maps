import type { GeoJSONData, GeoJSONPosition, LayerScene } from './layers';
import type { RenderItem, RenderScene } from './mapContent';
import type { Coordinate } from './types';

const dataCache = new WeakMap<
  readonly Coordinate[],
  { line?: GeoJSONData; polygons: WeakMap<object, GeoJSONData> }
>();
const positions = (
  coordinates: readonly Coordinate[],
): readonly GeoJSONPosition[] =>
  coordinates.map((p) => [p.longitude, p.latitude]);
function dataFor(item: RenderItem): GeoJSONData {
  if (item.coordinates.length === 0)
    return { type: 'FeatureCollection', features: [] };
  const holes = item.type === 'polygon' ? item.holes : undefined;
  const variants = dataCache.get(item.coordinates) ?? {
    polygons: new WeakMap<object, GeoJSONData>(),
  };
  const cached = holes ? variants.polygons.get(holes) : variants.line;
  if (cached) return cached;
  const geometry =
    item.type === 'polyline'
      ? {
          type: 'LineString' as const,
          coordinates: positions(item.coordinates),
        }
      : {
          type: 'Polygon' as const,
          coordinates: [
            positions(item.coordinates),
            ...item.holes.map(positions),
          ],
        };
  const data: GeoJSONData = {
    type: 'FeatureCollection',
    features: [{ type: 'Feature', id: 'geometry', properties: null, geometry }],
  };
  if (holes) variants.polygons.set(holes, data);
  else variants.line = data;
  dataCache.set(item.coordinates, variants);
  return data;
}
/** Internal transport to SDK-native shapes; no public source/layer API. */
export function nativeShapes(
  scene: RenderScene,
  previous: LayerScene,
): LayerScene {
  const sources = scene.items
    .map((item) => {
      const data = dataFor(item);
      const old = previous.sources.find((source) => source.id === item.id);
      const lineMetrics =
        item.type === 'polyline' && item.strokeGradient !== undefined;
      return {
        id: item.id,
        type: 'geojson' as const,
        coordinateSpace: 'unwrapped' as const,
        ...(lineMetrics ? { lineMetrics: true } : {}),
        revision: old
          ? old.revision +
            (old.data === data &&
            !!old.lineMetrics === lineMetrics &&
            old.coordinateSpace === 'unwrapped'
              ? 0
              : 1)
          : 0,
        data,
      };
    })
    .sort((a, b) => a.id.localeCompare(b.id));
  const layers: LayerScene['layers'][number][] = [];
  for (const item of scene.items) {
    const common = {
      source: item.id,
      visible: item.visible,
      interactive: item.tappable,
    };
    if (item.type === 'polygon')
      layers.push({
        ...common,
        id: `fill:${item.id}`,
        type: 'fill',
        style: { fillColor: item.fillColor, fillOpacity: item.opacity },
      });
    layers.push({
      ...common,
      id: `stroke:${item.id}`,
      type: 'line',
      style: {
        lineColor: item.strokeColor,
        ...(item.type === 'polyline' && item.strokeGradient
          ? { lineGradient: item.strokeGradient }
          : {}),
        lineWidth: item.strokeWidth,
        lineOpacity: item.opacity,
        lineCap: item.lineCap,
        lineJoin: item.lineJoin,
        lineMiterLimit: item.miterLimit,
        ...(item.lineDashPattern
          ? {
              lineDasharray: item.lineDashPattern.map(
                (length) => length / Math.max(item.strokeWidth, 0.001),
              ),
            }
          : {}),
      },
    });
  }
  const stableSources =
    sources.length === previous.sources.length &&
    sources.every((source, index) => {
      const old = previous.sources[index]!;
      return (
        old.id === source.id &&
        old.revision === source.revision &&
        old.lineMetrics === source.lineMetrics &&
        old.coordinateSpace === source.coordinateSpace &&
        old.data === source.data
      );
    })
      ? previous.sources
      : sources;
  return { sources: stableSources, layers };
}
