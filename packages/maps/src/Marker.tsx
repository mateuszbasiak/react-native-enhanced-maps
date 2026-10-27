import React, {
  useContext,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import type { ImageSourcePropType, ColorValue } from 'react-native';
import type { ReactNode } from 'react';
import { View, Image, Pressable } from 'react-native';
import NativeMarker from './specs/MarkerViewNativeComponent';
import { createMarkerDragGate } from './markerDrag';
import { rejectUnsupportedProps } from './rnMapsCompat';
import { MapContext } from './maplibreContext';
import type { Coordinate } from './types';
export interface MarkerProps {
  readonly draggable?: boolean;
  readonly onDragStart?: (event: MarkerDragEvent) => void;
  readonly onDrag?: (event: MarkerDragEvent) => void;
  readonly onDragEnd?: (event: MarkerDragEvent) => void;
  readonly onDragCancel?: (event: MarkerDragEvent) => void;
  readonly id?: string;
  readonly identifier?: string;
  readonly centerOffset?: Readonly<{ x: number; y: number }>;
  readonly image?: ImageSourcePropType;
  readonly pinColor?: ColorValue;
  readonly onPress?: (event: MarkerPressEvent) => void;
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
  readonly children?: ReactNode;
}
export interface MarkerPressEvent {
  readonly stopPropagation: () => void;
  readonly nativeEvent: {
    readonly action: 'marker-press';
    readonly id: string;
    readonly coordinate: Coordinate;
  };
}
export interface MarkerDragEvent {
  readonly nativeEvent: {
    readonly coordinate: Coordinate;
    readonly id: string;
  };
}
/** Mounted React children with map-rendered Android visuals and native input. */
export function Marker(props: MarkerProps) {
  rejectUnsupportedProps(props, 'Marker');
  const {
    id: providedId,
    identifier,
    centerOffset,
    image,
    pinColor = '#e53935',
    onPress,
    coordinate,
    zIndex = 0,
    anchor: providedAnchor,
    offset: providedOffset = { x: 0, y: 0 },
    children,
  } = props;
  const generatedId = useId();
  const enabled = props.draggable ?? false;
  if (typeof enabled !== 'boolean')
    throw new TypeError('Marker draggable must be a boolean');
  if (enabled && (props.cluster ?? props.clusterGroup !== undefined))
    throw new Error(
      'Draggable markers cannot participate in clustering; set cluster={false}',
    );
  const [dragState, setDragState] = useState({ enabled, revision: 0 });
  if (dragState.enabled !== enabled)
    setDragState({ enabled, revision: dragState.revision + 1 });
  const [dragGate] = useState(createMarkerDragGate);
  const latest = useRef(props);
  useLayoutEffect(() => {
    latest.current = props;
  });
  useLayoutEffect(
    () => () => {
      const p = latest.current;
      const cancel = dragGate.cancel(p.coordinate);
      if (cancel)
        p.onDragCancel?.({
          nativeEvent: {
            coordinate: cancel.coordinate,
            id: p.identifier ?? p.id ?? `em-auto:${generatedId}`,
          },
        });
    },
    [dragGate, generatedId],
  );
  const id = providedId ?? identifier ?? `em-auto:${generatedId}`;
  const offset = centerOffset ?? providedOffset;
  const anchor = providedAnchor ?? { x: 0.5, y: centerOffset ? 0.5 : 1 };
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
  dragGate.syncCoordinate(coordinate);
  const content =
    children ??
    (image ? (
      <Image source={image} />
    ) : (
      <View
        accessibilityLabel="Map marker"
        style={{
          width: 24,
          height: 32,
          borderRadius: 12,
          backgroundColor: pinColor,
          borderWidth: 2,
          borderColor: 'white',
        }}
      />
    ));
  return (
    <NativeMarker
      collapsable={false}
      markerID={id}
      draggable={enabled}
      dragRevision={dragState.revision}
      onMarkerDrag={({ nativeEvent }) => {
        const sample = dragGate.accept(
          nativeEvent,
          dragState.revision,
          enabled,
        );
        if (!sample) return;
        const callback =
          sample.phase === 'start'
            ? props.onDragStart
            : sample.phase === 'update'
              ? props.onDrag
              : sample.phase === 'end'
                ? props.onDragEnd
                : props.onDragCancel;
        callback?.({
          nativeEvent: { coordinate: sample.coordinate, id: identifier ?? id },
        });
      }}
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
        {onPress ? (
          <Pressable
            onPress={(event) =>
              onPress({
                stopPropagation: () => event.stopPropagation(),
                nativeEvent: {
                  action: 'marker-press',
                  id: identifier ?? id!,
                  coordinate: dragGate.syncCoordinate(coordinate),
                },
              })
            }
          >
            {content}
          </Pressable>
        ) : (
          content
        )}
      </View>
    </NativeMarker>
  );
}
