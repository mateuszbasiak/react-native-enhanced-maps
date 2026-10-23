import type { MapSettings } from './types';

export function normalizeMapSettings(
  input: MapSettings,
): Readonly<Required<MapSettings>> {
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
  return Object.freeze({
    scrollEnabled: flag('scrollEnabled'),
    zoomEnabled: flag('zoomEnabled'),
    rotateEnabled: flag('rotateEnabled'),
    pitchEnabled: flag('pitchEnabled'),
    showsCompass: flag('showsCompass'),
    minZoomLevel,
    maxZoomLevel,
  });
}
