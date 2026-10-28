import type { ReactNode } from 'react';
import { normalizeUrlTile } from './UrlTile.ts';
import type { UrlTileProps } from './UrlTile';
type TileDisplayProps = Pick<
  UrlTileProps,
  'id' | 'tileSize' | 'minimumZ' | 'maximumZ' | 'opacity' | 'visible' | 'zIndex'
>;
export interface WMSTileProps extends TileDisplayProps {
  readonly urlTemplate: string;
}
export interface LocalTileProps extends Pick<
  TileDisplayProps,
  'id' | 'tileSize' | 'zIndex'
> {
  readonly pathTemplate: string;
  readonly useAssets?: boolean;
}
export function WMSTile(_props: WMSTileProps): ReactNode {
  throw new Error('WMSTile must be a MapView child');
}
export function LocalTile(_props: LocalTileProps): ReactNode {
  throw new Error('LocalTile must be a MapView child');
}
const displayKeys = [
  'id',
  'tileSize',
  'minimumZ',
  'maximumZ',
  'opacity',
  'visible',
  'zIndex',
];
export function normalizeWMSTile(props: WMSTileProps) {
  if (
    Object.keys(props).some(
      (k) => !displayKeys.includes(k) && k !== 'urlTemplate',
    )
  )
    throw new Error('Unsupported WMSTile prop');
  const { urlTemplate, ...display } = props;
  if (
    typeof urlTemplate !== 'string' ||
    !urlTemplate.includes('{minX},{minY},{maxX},{maxY}')
  )
    throw new Error(
      'WMSTile requires bbox={minX},{minY},{maxX},{maxY} Web Mercator bounds',
    );
  const options = normalizeUrlTile({
    ...display,
    urlTemplate: 'https://example.invalid/{z}/{x}/{y}',
  });
  const template = urlTemplate
    .replaceAll('{minX},{minY},{maxX},{maxY}', '{bbox-epsg-3857}')
    .replaceAll('{width}', String(options.tileSize))
    .replaceAll('{height}', String(options.tileSize));
  if (
    template.length > 4096 ||
    !/^https?:\/\/[^/\s{}?#]+\/[^\s#]*$/.test(template) ||
    /[{}]/.test(template.replaceAll('{bbox-epsg-3857}', ''))
  )
    throw new Error('Invalid WMSTile URL or unsupported bounds placeholders');
  return { ...options, urlTemplate: template, tileKind: 'wms' as const };
}
export function normalizeLocalTile(props: LocalTileProps) {
  if (
    Object.keys(props).some(
      (k) =>
        !['id', 'pathTemplate', 'tileSize', 'zIndex', 'useAssets'].includes(k),
    )
  )
    throw new Error('Unsupported LocalTile prop');
  if (props.useAssets !== undefined && typeof props.useAssets !== 'boolean')
    throw new TypeError('LocalTile useAssets must be boolean');
  let path = props.pathTemplate;
  if (
    typeof path !== 'string' ||
    path.length > 4096 ||
    !['{x}', '{y}', '{z}'].every((t) => path.includes(t)) ||
    /[{}]/.test(path.replace(/\{[xyz]\}/g, ''))
  )
    throw new Error('Invalid LocalTile pathTemplate');
  if (path.startsWith('file:///')) path = decodeURIComponent(path.slice(7));
  if (props.useAssets) {
    if (
      path.startsWith('/') ||
      path.includes(':') ||
      path.split('/').some((segment) => segment === '..')
    )
      throw new Error(
        'LocalTile asset paths must be relative without parent traversal',
      );
  } else if (!path.startsWith('/') || path.startsWith('//'))
    throw new Error('LocalTile requires an absolute filesystem path');
  if (
    Array.from(path).some(
      (c) =>
        c.charCodeAt(0) < 32 ||
        c.charCodeAt(0) === 127 ||
        c === '?' ||
        c === '#',
    )
  )
    throw new Error('Invalid LocalTile path characters');
  const encoded = path
    .split('/')
    .map((part) => encodeURIComponent(part).replace(/%7B([xyz])%7D/g, '{$1}'))
    .join('/');
  if (encoded.length > 4088)
    throw new Error('LocalTile encoded URI limit exceeded');
  const { tileSize, zIndex } = props;
  const options = normalizeUrlTile({
    urlTemplate: 'https://example.invalid/{z}/{x}/{y}',
    ...(tileSize === undefined ? {} : { tileSize }),
    ...(zIndex === undefined ? {} : { zIndex }),
  });
  return {
    ...options,
    urlTemplate: props.useAssets ? 'asset://' + encoded : 'file://' + encoded,
    tileKind: 'local' as const,
  };
}
