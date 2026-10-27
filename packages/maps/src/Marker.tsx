import React, {
  useContext,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  forwardRef,
  useImperativeHandle,
  useSyncExternalStore,
} from 'react';
import type { ImageSourcePropType, ColorValue } from 'react-native';
import type { ReactNode } from 'react';
import { View, Image, Pressable, Text } from 'react-native';
import NativeMarker from './specs/MarkerViewNativeComponent';
import { createMarkerDragGate } from './markerDrag';
import { rejectUnsupportedProps } from './rnMapsCompat';
import { MapContext } from './maplibreContext';
import type { Coordinate } from './types';
import { Callout } from './Callout';
import type { CalloutPressEvent } from './Callout';
import { extractCallout, calloutOffset, calloutText } from './calloutContent';
export interface MarkerRef {
  showCallout(): void;
  hideCallout(): void;
}
export type Marker = MarkerRef;
export interface MarkerProps {
  readonly accessibilityLabel?: string;
  readonly title?: string;
  readonly description?: string;
  readonly calloutAnchor?: Readonly<{ x: number; y: number }>;
  readonly calloutOffset?: Readonly<{ x: number; y: number }>;
  readonly onSelect?: (event: MarkerSelectionEvent) => void;
  readonly onDeselect?: (event: MarkerSelectionEvent) => void;
  readonly onCalloutPress?: (event: CalloutPressEvent) => void;
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
export interface MarkerSelectionEvent {
  readonly nativeEvent: {
    readonly action: 'marker-select' | 'marker-deselect';
    readonly id: string;
    readonly coordinate: Coordinate;
  };
}
/** Mounted React children with map-rendered Android visuals and native input. */
export const Marker = forwardRef<MarkerRef, MarkerProps>(
  function Marker(props, ref) {
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
    const map = useContext(MapContext);
    if (!map) throw new Error('Marker must be inside MapView');
    const [owner] = useState(() => ({}));
    const selected = useSyncExternalStore(
      map.subscribe,
      () => map.getSnapshot()?.owner === owner,
      () => false,
    );
    const [pinSize, setPinSize] = useState({ width: 0, height: 0 });
    const extracted = extractCallout(children, Callout);
    const {
      tooltip = false,
      children: calloutChildren,
      onPress: calloutPress,
      style: calloutStyle,
      ...calloutViewProps
    } = extracted.callout?.props ?? {};
    const text = calloutText(props);
    const hasCallout =
      !!extracted.callout || !!text.title || !!text.description;
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
    useLayoutEffect(
      () =>
        map.register(id, owner, {
          select: () =>
            latest.current.onSelect?.({
              nativeEvent: {
                action: 'marker-select',
                id: latest.current.identifier ?? id,
                coordinate: dragGate.syncCoordinate(latest.current.coordinate),
              },
            }),
          deselect: () =>
            latest.current.onDeselect?.({
              nativeEvent: {
                action: 'marker-deselect',
                id: latest.current.identifier ?? id,
                coordinate: dragGate.syncCoordinate(latest.current.coordinate),
              },
            }),
        }),
      [map, id, owner, dragGate],
    );
    useLayoutEffect(() => {
      if (!hasCallout) map.hide(id, owner);
    }, [map, id, owner, hasCallout]);
    useImperativeHandle(
      ref,
      () => ({
        showCallout: () => {
          if (hasCallout) map.show(id, owner);
        },
        hideCallout: () => map.hide(id, owner),
      }),
      [map, id, owner, hasCallout],
    );
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
    const effectiveCoordinate = dragGate.syncCoordinate(coordinate);
    const bubbleOffset = calloutOffset(
      pinSize,
      anchor,
      offset,
      props.calloutAnchor,
      props.calloutOffset,
    );
    const content =
      (extracted.contentCount ? extracted.content : undefined) ??
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
      <>
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
            if (sample.phase === 'start') map.reset('drag');
            const callback =
              sample.phase === 'start'
                ? props.onDragStart
                : sample.phase === 'update'
                  ? props.onDrag
                  : sample.phase === 'end'
                    ? props.onDragEnd
                    : props.onDragCancel;
            callback?.({
              nativeEvent: {
                coordinate: sample.coordinate,
                id: identifier ?? id,
              },
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
            accessible={!onPress && !hasCallout && !!props.accessibilityLabel}
            accessibilityLabel={props.accessibilityLabel}
            style={{ alignSelf: 'flex-start' }}
            onLayout={({ nativeEvent: { layout } }) =>
              setPinSize((old) =>
                old.width === layout.width && old.height === layout.height
                  ? old
                  : { width: layout.width, height: layout.height },
              )
            }
          >
            {onPress || hasCallout || props.onSelect ? (
              <Pressable
                accessibilityRole="button"
                accessibilityState={
                  hasCallout ? { expanded: selected } : undefined
                }
                accessible={
                  !!props.accessibilityLabel || extracted.contentCount === 0
                }
                accessibilityLabel={
                  props.accessibilityLabel ?? props.title ?? identifier ?? id
                }
                onPress={(event) => {
                  if (hasCallout || props.onSelect) map.show(id, owner);
                  onPress?.({
                    stopPropagation: () => event.stopPropagation(),
                    nativeEvent: {
                      action: 'marker-press',
                      id: identifier ?? id!,
                      coordinate: dragGate.syncCoordinate(coordinate),
                    },
                  });
                }}
              >
                {content}
              </Pressable>
            ) : (
              content
            )}
          </View>
        </NativeMarker>
        {hasCallout && selected && pinSize.width > 0 && pinSize.height > 0 && (
          <NativeMarker
            callout
            markerID={`em-cluster:callout:${generatedId}`}
            latitude={effectiveCoordinate.latitude}
            longitude={effectiveCoordinate.longitude}
            anchorX={0.5}
            anchorY={1}
            offsetX={bubbleOffset.x}
            offsetY={bubbleOffset.y}
          >
            <View collapsable={false} style={{ alignSelf: 'flex-start' }}>
              <Pressable
                {...calloutViewProps}
                accessibilityRole={
                  calloutViewProps.accessibilityRole ??
                  (calloutPress || props.onCalloutPress ? 'button' : 'text')
                }
                accessible={
                  extracted.callout
                    ? (calloutViewProps.accessible ?? false)
                    : true
                }
                onPress={(event) => {
                  const wrapped: CalloutPressEvent = {
                    stopPropagation: () => event.stopPropagation(),
                    nativeEvent: {
                      action: 'callout-press',
                      id: identifier ?? id,
                      coordinate: dragGate.syncCoordinate(coordinate),
                    },
                  };
                  props.onCalloutPress?.(wrapped);
                  calloutPress?.(wrapped);
                }}
                style={[
                  tooltip
                    ? undefined
                    : {
                        maxWidth: 280,
                        minWidth: 96,
                        padding: 12,
                        backgroundColor: 'white',
                        borderRadius: 8,
                        borderWidth: 1,
                        borderColor: '#9ca3af',
                      },
                  calloutStyle,
                ]}
              >
                {extracted.callout ? (
                  calloutChildren
                ) : (
                  <>
                    {text.title ? (
                      <Text style={{ fontWeight: '600', color: '#111827' }}>
                        {text.title}
                      </Text>
                    ) : null}
                    {text.description ? (
                      <Text style={{ color: '#374151' }}>
                        {text.description}
                      </Text>
                    ) : null}
                  </>
                )}
              </Pressable>
              {!tooltip && (
                <View
                  pointerEvents="none"
                  style={{
                    alignSelf: 'center',
                    width: 0,
                    height: 0,
                    borderLeftWidth: 7,
                    borderRightWidth: 7,
                    borderTopWidth: 8,
                    borderLeftColor: 'transparent',
                    borderRightColor: 'transparent',
                    borderTopColor: 'white',
                  }}
                />
              )}
            </View>
          </NativeMarker>
        )}
      </>
    );
  },
);
