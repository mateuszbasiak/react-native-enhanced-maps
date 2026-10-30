import type { ReactNode } from 'react';
import type { ImageRequireSource, ImageURISource } from 'react-native';
import type { Coordinate, Point } from './types';
export interface OverlayPressEvent {
  readonly nativeEvent: {
    readonly action: 'overlay-press';
    readonly coordinate: Coordinate;
    readonly position: Point;
  };
}
export interface OverlayProps {
  readonly image: ImageRequireSource | ImageURISource;
  /** RN Maps Fabric order: northeast, southwest; tuple values are latitude then longitude. */
  readonly bounds: readonly [
    readonly [number, number],
    readonly [number, number],
  ];
  readonly bearing?: number;
  readonly opacity?: number;
  readonly tappable?: boolean;
  readonly onPress?: (event: OverlayPressEvent) => void;
}
export function Overlay(_props: OverlayProps): ReactNode {
  throw new Error('Overlay must be a MapView child');
}
export type ImageResolver = (
  image: OverlayProps['image'],
) => { readonly uri: string } | undefined;
function numeric(v: unknown, min: number, max: number) {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max)
    throw new RangeError('Invalid Overlay number');
  return v;
}
export function normalizeOverlay(
  props: OverlayProps,
  resolveImage?: ImageResolver,
) {
  if (
    Object.keys(props).some(
      (k) =>
        ![
          'image',
          'bounds',
          'bearing',
          'opacity',
          'tappable',
          'onPress',
        ].includes(k),
    )
  )
    throw new Error('Unsupported Overlay prop');
  const bounds = props.bounds;
  if (
    !Array.isArray(bounds) ||
    bounds.length !== 2 ||
    !bounds.every((c) => Array.isArray(c) && c.length === 2)
  )
    throw new Error('Overlay requires northeast/southwest coordinate tuples');
  const north = numeric(bounds[0][0], -85, 85),
    south = numeric(bounds[1][0], -85, 85),
    west = numeric(bounds[1][1], -180, 180);
  let east = numeric(bounds[0][1], -180, 180);
  if (east < west) east += 360;
  if (north <= south || east <= west || east - west >= 180)
    throw new Error(
      'Overlay bounds must have positive latitude/longitude spans below 180 degrees',
    );
  const bearing =
    ((numeric(props.bearing ?? 0, -Number.MAX_VALUE, Number.MAX_VALUE) % 360) +
      360) %
    360;
  const opacity = numeric(props.opacity ?? 1, 0, 1),
    tappable = props.tappable ?? false;
  if (
    typeof tappable !== 'boolean' ||
    (props.onPress !== undefined && typeof props.onPress !== 'function')
  )
    throw new Error('Invalid Overlay interaction props');
  const image = props.image;
  if (
    !image ||
    (typeof image !== 'number' &&
      (typeof image !== 'object' || Array.isArray(image)))
  )
    throw new Error('Overlay requires an image asset or URI source');
  if (
    typeof image === 'object' &&
    Object.keys(image).some(
      (k) => !['uri', 'width', 'height', 'scale'].includes(k),
    )
  )
    throw new Error(
      'Overlay URI headers/method/cache options are not supported',
    );
  const uri =
    typeof image === 'object' ? image.uri : resolveImage?.(image)?.uri;
  if (
    typeof uri !== 'string' ||
    !(
      /^https?:\/\/[^\s]+$/.test(uri) ||
      /^file:\/\/\/[^\s]+$/.test(uri) ||
      /^asset:\/[^\s]+$/.test(uri) ||
      /^[a-z][a-z0-9_]*$/.test(uri)
    )
  )
    throw new Error(
      'Overlay image must resolve to HTTP(S), file, asset or an Android resource',
    );
  const corners = [
    [west, north],
    [east, north],
    [east, south],
    [west, south],
  ] as const;
  const radians = Math.PI / 180;
  const mercator = (lat: number) =>
    Math.log(Math.tan(Math.PI / 4 + (lat * radians) / 2)) / radians;
  const centerX = (west + east) / 2,
    centerY = (mercator(north) + mercator(south)) / 2;
  const angle = bearing * radians;
  const coordinates = corners.map(([lon, lat]) => {
    if (bearing === 0) return [lon, lat] as const;
    const x = lon - centerX,
      y = mercator(lat) - centerY;
    const longitude = centerX + x * Math.cos(angle) + y * Math.sin(angle);
    const latitude =
      (2 *
        Math.atan(
          Math.exp(
            (centerY - x * Math.sin(angle) + y * Math.cos(angle)) * radians,
          ),
        ) -
        Math.PI / 2) /
      radians;
    numeric(latitude, -85, 85);
    numeric(longitude, -540, 540);
    return [longitude, latitude] as const;
  });
  return {
    uri:
      uri.startsWith('asset:/') && !uri.startsWith('asset://')
        ? uri.replace('asset:/', 'asset://')
        : uri,
    coordinates,
    opacity,
    tappable,
    bearing,
  };
}
