import type { MapSettings } from './types';

export function normalizeMapSettings(input: MapSettings): Readonly<
  Omit<Required<MapSettings>, 'mapPadding'> & {
    mapPaddingTop: number;
    mapPaddingRight: number;
    mapPaddingBottom: number;
    mapPaddingLeft: number;
  }
> {
  const flag = (
    name:
      | 'scrollEnabled'
      | 'zoomEnabled'
      | 'rotateEnabled'
      | 'pitchEnabled'
      | 'showsCompass',
  ) => {
    const value = input[name];
    if (value === undefined) return true;
    if (typeof value !== 'boolean')
      throw new TypeError(`${name} must be a boolean`);
    return value;
  };
  const minZoomLevel =
    input.minZoomLevel === undefined ? 0 : input.minZoomLevel;
  const maxZoomLevel =
    input.maxZoomLevel === undefined ? 24 : input.maxZoomLevel;
  if (
    !Number.isFinite(minZoomLevel) ||
    !Number.isFinite(maxZoomLevel) ||
    minZoomLevel < 0 ||
    maxZoomLevel > 24 ||
    minZoomLevel > maxZoomLevel
  )
    throw new RangeError('Map zoom limits must be ordered within [0,24]');
  const padding = input.mapPadding === undefined ? 0 : input.mapPadding;
  const edges =
    typeof padding === 'number'
      ? { top: padding, right: padding, bottom: padding, left: padding }
      : padding;
  for (const edge of [edges?.top, edges?.right, edges?.bottom, edges?.left])
    if (
      typeof edge !== 'number' ||
      !Number.isFinite(edge) ||
      edge < 0 ||
      edge > 100000
    )
      throw new RangeError(
        'Map padding must contain finite nonnegative logical points',
      );
  return Object.freeze({
    mapPaddingTop: edges.top,
    mapPaddingRight: edges.right,
    mapPaddingBottom: edges.bottom,
    mapPaddingLeft: edges.left,
    scrollEnabled: flag('scrollEnabled'),
    zoomEnabled: flag('zoomEnabled'),
    rotateEnabled: flag('rotateEnabled'),
    pitchEnabled: flag('pitchEnabled'),
    showsCompass: flag('showsCompass'),
    minZoomLevel,
    maxZoomLevel,
  });
}
