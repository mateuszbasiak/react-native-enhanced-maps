import React, { useContext } from 'react';
import type { ReactNode } from 'react';
import { View } from 'react-native';
import NativeMarker from './specs/MarkerViewNativeComponent';
import { MapContext } from './maplibreContext';
import type { Coordinate } from './types';
export interface MarkerProps {
  readonly id: string;
  readonly coordinate: Coordinate;
  /** Override clustering participation. Defaults to true when clusterGroup is set, otherwise false. */
  readonly cluster?: boolean;
  /** Enable clustering within this group unless cluster is false. Omission uses the default group. */
  readonly clusterGroup?: string;
  /** Application metadata returned lazily by a cluster's getMembers(). */
  readonly data?: unknown;
  readonly zIndex?: number;
  readonly anchor?: Readonly<{ x: number; y: number }>;
  readonly offset?: Readonly<{ x: number; y: number }>;
  readonly children: ReactNode;
}
/** Mounted React children with map-rendered Android visuals and native input. */
export function Marker({
  id,
  coordinate,
  zIndex = 0,
  anchor = { x: 0.5, y: 1 },
  offset = { x: 0, y: 0 },
  children,
}: MarkerProps) {
  if (!useContext(MapContext)) throw new Error('Marker must be inside MapView');
  if (!id || typeof id !== 'string')
    throw new Error('Marker requires a stable id');
  if (
    ![
      coordinate.latitude,
      coordinate.longitude,
      zIndex,
      anchor.x,
      anchor.y,
      offset.x,
      offset.y,
    ].every(Number.isFinite)
  )
    throw new RangeError('Marker geometry and zIndex must be finite');
  if (
    Math.abs(coordinate.latitude) > 90 ||
    Math.abs(coordinate.longitude) > 180
  )
    throw new RangeError('Invalid marker coordinate');
  if (anchor.x < 0 || anchor.x > 1 || anchor.y < 0 || anchor.y > 1)
    throw new RangeError('Marker anchor must be within [0,1]');
  return (
    <NativeMarker
      collapsable={false}
      markerID={id}
      latitude={coordinate.latitude}
      longitude={coordinate.longitude}
      markerZIndex={zIndex}
      anchorX={anchor.x}
      anchorY={anchor.y}
      offsetX={offset.x}
      offsetY={offset.y}
    >
      <View
        collapsable={false}
        pointerEvents="box-none"
        style={{ alignSelf: 'flex-start' }}
      >
        {children}
      </View>
    </NativeMarker>
  );
}
