import React, {
  forwardRef,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ElementRef } from 'react';
import { Platform } from 'react-native';
import NativeMap, { Commands } from './specs/MapLibreViewNativeComponent';
import { MapContext } from './maplibreContext';
import { compileScene } from './maplibreContent';
import { validateCamera, classifyMapError } from './contracts';
import { createMapReadiness } from './capabilities';
import { normalizeCameraOrigin } from './cameraOrigin';
import { fitRequest } from './cameraFit';
import {
  createClusterHandles,
  parseClusterQueryResult,
} from './clusterQueries';
import type { NativeClusterPage } from './clusterQueries';
import { parseNativeGesture, validateGestureInterval } from './gestures';
import { parseNativeFeatureHit } from './featureHits';
import { parseNativeMapPress } from './mapPressEvents';
import {
  createMapQueryClient,
  validateMapCoordinate,
  validateMapPoint,
} from './mapQueries';
import type {
  Camera,
  MapCapabilities,
  MapViewProps,
  MapViewRef,
  Coordinate,
  MapPoint,
  MapBounds,
} from './types';
const defaultCamera: Camera = {
  center: { latitude: 0, longitude: 0 },
  zoom: 3,
  heading: 0,
  pitch: 0,
};
export const MapView = forwardRef<MapViewRef, MapViewProps>(
  function MapView(props, ref) {
    if (Platform.OS !== 'ios' && Platform.OS !== 'android')
      throw new Error('MapView supports iOS and Android only');
    if (typeof props.styleURL !== 'string' || !props.styleURL.trim())
      throw new Error('MapView requires styleURL');
    const gestureInterval = validateGestureInterval(
      props.gestureEventIntervalMs,
    );
    const gestureEnabled = Boolean(props.onGesture);
    const [gestureSubscription, setGestureSubscription] = useState({
      enabled: gestureEnabled,
      revision: 0,
    });
    if (gestureSubscription.enabled !== gestureEnabled)
      setGestureSubscription({
        enabled: gestureEnabled,
        revision: gestureSubscription.revision + 1,
      });
    const nativeRef = useRef<ElementRef<typeof NativeMap>>(null);
    const { styleURL, onCapabilitiesChange } = props;
    const [styleRequest, setStyleRequest] = useState({
      url: styleURL,
      revision: 0,
    });
    if (styleRequest.url !== styleURL)
      setStyleRequest({ url: styleURL, revision: styleRequest.revision + 1 });
    const [readiness] = useState(() =>
      createMapReadiness(Platform.OS as 'ios' | 'android'),
    );
    const previousRequest = useRef(styleRequest.revision);
    const [clusterHandles] = useState(createClusterHandles);
    const [queries] = useState(() =>
      createMapQueryClient(
        (id, request) => {
          if (!nativeRef.current) throw new Error('Map is not mounted');
          Commands.queryMap(nativeRef.current, id, JSON.stringify(request));
        },
        { parseClusterResult: parseClusterQueryResult },
      ),
    );
    useLayoutEffect(
      () => () =>
        queries.cancelAll('Map query invalidated by style change or unmount'),
      [queries, styleRequest.revision],
    );
    useLayoutEffect(() => {
      readiness.activate(styleRequest.revision);
      if (previousRequest.current !== styleRequest.revision) {
        previousRequest.current = styleRequest.revision;
        onCapabilitiesChange?.(null);
      }
    }, [styleRequest.revision, readiness, onCapabilitiesChange]);
    useLayoutEffect(() => () => readiness.deactivate(), [readiness]);
    const [initial] = useState(() =>
      validateCamera(props.initialCamera ?? defaultCamera),
    );
    const scene = useMemo(() => compileScene(props.children), [props.children]);
    useImperativeHandle(
      ref,
      () => ({
        async getClusterChildren(cluster, page) {
          if (!readiness.getCapabilities()) throw new Error('Map is not ready');
          const result = await queries.request(
            'clusterChildren',
            clusterHandles.request(cluster, styleRequest.revision, page),
            styleRequest.revision,
          );
          return clusterHandles.page(
            result as NativeClusterPage,
            styleRequest.revision,
          );
        },
        async getClusterLeaves(cluster, page) {
          if (!readiness.getCapabilities()) throw new Error('Map is not ready');
          const result = await queries.request(
            'clusterLeaves',
            clusterHandles.request(cluster, styleRequest.revision, page),
            styleRequest.revision,
          );
          return clusterHandles.page(
            result as NativeClusterPage,
            styleRequest.revision,
          );
        },
        async getClusterExpansionZoom(cluster) {
          if (!readiness.getCapabilities()) throw new Error('Map is not ready');
          return (await queries.request(
            'clusterExpansion',
            clusterHandles.request(cluster, styleRequest.revision),
            styleRequest.revision,
          )) as number;
        },
        async fitCoordinates(coordinates, options) {
          if (!readiness.getCapabilities()) throw new Error('Map is not ready');
          await queries.request(
            'fit',
            fitRequest(coordinates, options),
            styleRequest.revision,
          );
        },
        async fitElements(options) {
          if (!readiness.getCapabilities()) throw new Error('Map is not ready');
          await queries.request(
            'fit',
            fitRequest(undefined, options),
            styleRequest.revision,
          );
        },
        async pointForCoordinate(coordinate) {
          const value = validateMapCoordinate(coordinate);
          if (!readiness.getCapabilities()) throw new Error('Map is not ready');
          return (await queries.request(
            'point',
            { latitude: value.latitude, longitude: value.longitude },
            styleRequest.revision,
          )) as MapPoint;
        },
        async coordinateForPoint(point) {
          const value = validateMapPoint(point);
          if (!readiness.getCapabilities()) throw new Error('Map is not ready');
          return (await queries.request(
            'coordinate',
            { x: value.x, y: value.y },
            styleRequest.revision,
          )) as Coordinate;
        },
        async getVisibleBounds() {
          if (!readiness.getCapabilities()) throw new Error('Map is not ready');
          return (await queries.request(
            'bounds',
            {},
            styleRequest.revision,
          )) as MapBounds;
        },
        getCapabilities() {
          return readiness.getCapabilities();
        },
        animateCamera(camera, durationMs = 300) {
          validateCamera(camera);
          if (!Number.isFinite(durationMs) || durationMs < 0)
            throw new RangeError(
              'Camera duration must be finite and non-negative',
            );
          if (!readiness.getCapabilities() || !nativeRef.current)
            throw new Error('Map is not ready');
          Commands.animateCamera(
            nativeRef.current,
            camera.center.latitude,
            camera.center.longitude,
            camera.zoom,
            camera.heading,
            camera.pitch,
            durationMs,
          );
        },
      }),
      [readiness, queries, styleRequest.revision, clusterHandles],
    );
    return (
      <MapContext.Provider value={true}>
        <NativeMap
          ref={nativeRef}
          style={props.style}
          testID={props.testID}
          styleURL={props.styleURL}
          styleRevision={styleRequest.revision}
          sceneJSON={scene.json}
          onMapQueryResult={({ nativeEvent: e }) => {
            if (
              e.styleRevision !== styleRequest.revision ||
              !readiness.getCapabilities()
            )
              return;
            queries.accept(e.requestId, e.resultJSON, e.error);
          }}
          mapPressEventsEnabled={Boolean(props.onPress || props.onLongPress)}
          onMapPress={({ nativeEvent }) => {
            if (
              nativeEvent.styleRevision !== styleRequest.revision ||
              !readiness.getCapabilities()
            )
              return;
            const event = parseNativeMapPress(nativeEvent);
            if (!event) return;
            if (event.action === 'tap') props.onPress?.(event);
            else props.onLongPress?.(event);
          }}
          gestureEventsEnabled={gestureEnabled}
          gestureSubscriptionRevision={gestureSubscription.revision}
          gestureEventIntervalMs={gestureInterval}
          onGesture={({ nativeEvent }) => {
            if (
              !gestureEnabled ||
              nativeEvent.subscriptionRevision !== gestureSubscription.revision
            )
              return;
            const event = parseNativeGesture(nativeEvent);
            if (event) props.onGesture?.(event);
          }}
          initialLatitude={initial.center.latitude}
          initialLongitude={initial.center.longitude}
          initialZoom={initial.zoom}
          initialHeading={initial.heading}
          initialPitch={initial.pitch}
          onMapReady={({ nativeEvent }) => {
            let report: MapCapabilities | null;
            try {
              report = readiness.acceptReport(
                nativeEvent.styleRevision,
                nativeEvent.capabilitiesJSON,
              );
            } catch {
              readiness.invalidate();
              queries.cancelAll('Map is unavailable');
              props.onCapabilitiesChange?.(null);
              props.onError?.({
                code: 'invalid-native-capabilities',
                message: 'Invalid native map capabilities',
                fatal: true,
              });
              return;
            }
            if (!report) return;
            props.onCapabilitiesChange?.(report);
            props.onMapReady?.();
          }}
          onMapError={({ nativeEvent }) => {
            const error = classifyMapError(nativeEvent);
            if (error.fatal) {
              readiness.invalidate();
              queries.cancelAll('Map is unavailable');
              props.onCapabilitiesChange?.(null);
            }
            props.onError?.(error);
          }}
          onCameraIdle={({ nativeEvent: e }) =>
            props.onCameraIdle?.({
              camera: {
                center: { latitude: e.latitude, longitude: e.longitude },
                zoom: e.zoom,
                heading: e.heading,
                pitch: e.pitch,
              },
              origin: normalizeCameraOrigin(e.origin),
            })
          }
          onFeaturePress={({ nativeEvent: e }) => {
            if (e.styleRevision !== styleRequest.revision) return;
            let hit = parseNativeFeatureHit(e);
            if (!hit) return;
            if (e.indexRevision > 0) {
              const cluster = clusterHandles.capture(
                hit.sourceId,
                hit.featureId,
                hit.properties,
                e.indexRevision,
                e.styleRevision,
              );
              if (!cluster) return;
              hit = { ...hit, cluster };
            }
            scene.presses.get(hit.sourceId)?.(hit.featureId, {
              coordinate: hit.coordinate,
              position: hit.position,
            });
            scene.featurePresses.get(hit.sourceId)?.(hit);
          }}
        >
          {scene.live}
        </NativeMap>
      </MapContext.Provider>
    );
  },
);
