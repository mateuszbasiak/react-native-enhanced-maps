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
function individualShapes(
  scene: RenderScene,
  previous: LayerScene,
): LayerScene {
  const oldSources = new Map(
    previous.sources.map((source) => [source.id, source]),
  );
  const sources = scene.items
    .map((item) => {
      const data = dataFor(item);
      const old = oldSources.get(item.id);
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

/** Batch component features; layout-only differences retain ordered stroke runs. */
export function nativeShapes(
  scene: RenderScene,
  previous: LayerScene,
  canShareGroup: (left: string, right: string) => boolean = () => true,
): LayerScene {
  const groups: RenderItem[][] = [];
  for (const item of scene.items) {
    const group = groups.at(-1);
    if (
      group &&
      group[0]!.zIndex === item.zIndex &&
      canShareGroup(group.at(-1)!.id, item.id)
    )
      group.push(item);
    else groups.push([item]);
  }
  const sources: LayerScene['sources'][number][] = [];
  const layers: LayerScene['layers'][number][] = [];
  const oldSources = new Map(
    previous.sources.map((source) => [source.id, source]),
  );
  for (const group of groups) {
    const individual = individualShapes({ version: 1, items: group }, previous);
    if (group.length === 1) {
      sources.push(...individual.sources);
      layers.push(...individual.layers);
      continue;
    }
    const id = group[0]!.id;
    const strokes = individual.layers.filter((layer) => layer.type === 'line');
    let signature = '',
      run = -1;
    const features: GeoJSONData['features'][number][] = [];
    const groupLayers: LayerScene['layers'][number][] = [];
    if (group.some((item) => item.type === 'polygon'))
      groupLayers.push({
        id: `fill:${id}`,
        source: id,
        type: 'fill',
        visible: true,
        shapeGroup: 0,
        style: { fillColor: '#000000', fillOpacity: 1 },
      });
    for (const [order, item] of group.entries()) {
      const stroke = strokes[order]!;
      const {
        lineColor: _color,
        lineWidth: _width,
        lineOpacity: _opacity,
        ...layout
      } = stroke.style;
      const nextSignature = JSON.stringify(layout);
      if (nextSignature !== signature) {
        signature = nextSignature;
        run++;
        groupLayers.push({
          ...stroke,
          id: `stroke:${item.id}`,
          source: id,
          visible: true,
          shapeGroup: run,
        });
      }
      for (const feature of dataFor(item).features)
        features.push({
          ...feature,
          id: item.id,
          properties: {
            __shape_order: order,
            __shape_line_group: run,
            __shape_visible: item.visible,
            __shape_tappable: item.tappable,
            __shape_stroke: item.strokeColor,
            __shape_fill:
              item.type === 'polygon' ? item.fillColor : '#00000000',
            __shape_width: item.strokeWidth,
            __shape_opacity: item.opacity,
          },
        });
    }
    const old = oldSources.get(id);
    const lineMetrics = group.some(
      (item) => item.type === 'polyline' && !!item.strokeGradient,
    );
    const unchanged =
      old &&
      !!old.lineMetrics === lineMetrics &&
      old.data.features.length === features.length &&
      features.every((feature, index) => {
        const previous = old.data.features[index]!;
        return (
          previous.id === feature.id &&
          previous.geometry === feature.geometry &&
          JSON.stringify(previous.properties) ===
            JSON.stringify(feature.properties)
        );
      });
    sources.push({
      id,
      type: 'geojson',
      coordinateSpace: 'unwrapped',
      ...(lineMetrics ? { lineMetrics: true } : {}),
      data: unchanged ? old.data : { type: 'FeatureCollection', features },
      revision: old ? old.revision + (unchanged ? 0 : 1) : 0,
    });
    for (const layer of groupLayers) layers.push(layer);
  }
  sources.sort((a, b) => a.id.localeCompare(b.id));
  return {
    sources:
      sources.length === previous.sources.length &&
      sources.every((source, index) => {
        const old = previous.sources[index]!;
        return (
          source.id === old.id &&
          source.revision === old.revision &&
          source.data === old.data &&
          source.lineMetrics === old.lineMetrics
        );
      })
        ? previous.sources
        : sources,
    layers,
  };
}
