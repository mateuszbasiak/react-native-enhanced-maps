import type { ReactNode } from 'react';

export interface UrlTileProps {
  readonly id?: string;
  readonly urlTemplate: string;
  readonly tileSize?: number;
  readonly flipY?: boolean;
  readonly minimumZ?: number;
  readonly maximumZ?: number;
  readonly opacity?: number;
  readonly visible?: boolean;
  readonly zIndex?: number;
}
/** Native XYZ raster imagery; consumed by MapView without a React view host. */
export function UrlTile(_props: UrlTileProps): ReactNode {
  throw new Error(
    'UrlTile must be a direct MapView child or inside a Fragment',
  );
}
const supportedProps = new Set([
  'id',
  'urlTemplate',
  'tileSize',
  'flipY',
  'minimumZ',
  'maximumZ',
  'opacity',
  'visible',
  'zIndex',
]);
export function normalizeUrlTile(props: UrlTileProps) {
  for (const key of Object.keys(props))
    if (!supportedProps.has(key))
      throw new TypeError(`Unsupported UrlTile prop: ${key}`);
  const {
    urlTemplate,
    tileSize = 256,
    flipY = false,
    minimumZ = 0,
    maximumZ = 22,
    opacity = 1,
    visible = true,
    zIndex = 0,
  } = props;
  if (
    typeof urlTemplate !== 'string' ||
    urlTemplate.length > 4096 ||
    urlTemplate.includes('#') ||
    !/^https?:\/\/[^/\s{}?#]+\/[^\s]*$/.test(urlTemplate) ||
    !['{x}', '{y}', '{z}'].every((token) => urlTemplate.includes(token)) ||
    /[{}]/.test(urlTemplate.replace(/\{[xyz]\}/g, ''))
  )
    throw new TypeError(
      'UrlTile requires an HTTP(S) XYZ urlTemplate of at most 4096 characters',
    );
  if (
    !Number.isInteger(tileSize) ||
    tileSize < 64 ||
    tileSize > 1024 ||
    (tileSize & (tileSize - 1)) !== 0
  )
    throw new RangeError(
      'UrlTile tileSize must be a power of two from 64 to 1024',
    );
  if (
    ![minimumZ, maximumZ].every(
      (n) => Number.isInteger(n) && n >= 0 && n <= 22,
    ) ||
    minimumZ > maximumZ
  )
    throw new RangeError(
      'UrlTile zoom bounds must be ordered integers from 0 to 22',
    );
  if (
    !Number.isFinite(opacity) ||
    opacity < 0 ||
    opacity > 1 ||
    !Number.isFinite(zIndex)
  )
    throw new RangeError(
      'UrlTile opacity must be within [0,1] and zIndex finite',
    );
  if (typeof flipY !== 'boolean')
    throw new TypeError('UrlTile flipY must be boolean');
  if (typeof visible !== 'boolean')
    throw new TypeError('UrlTile visible must be boolean');
  return {
    urlTemplate,
    tileSize,
    ...(flipY ? { scheme: 'tms' as const } : {}),
    minZoom: minimumZ,
    maxZoom: maximumZ,
    opacity,
    visible,
    zIndex,
  };
}
