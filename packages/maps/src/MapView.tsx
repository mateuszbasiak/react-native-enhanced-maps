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
import { Marker } from './Marker';
import { DefaultCluster } from './DefaultCluster';
import {
  collectMarkers,
  markerSourceID,
  parseMarkerLayout,
  resolveClusterMembers,
} from './markerClustering';
import type { MarkerLayout } from './markerClustering';
import NativeMap, { Commands } from './specs/MapLibreViewNativeComponent';
import { MapContext } from './maplibreContext';
import { ShaderMapContext } from './shaderContext';
import { compileScene, InternalSource, InternalLayer } from './maplibreContent';
import { validateCamera, classifyMapError } from './contracts';
import { createMapReadiness } from './capabilities';
import { normalizeCameraOrigin } from './cameraOrigin';
import { fitRequest } from './cameraFit';
import {
  createClusterHandles,
  parseClusterQueryResult,
} from './clusterQueries';
import type { NativeClusterPage } from './clusterQueries';
import { normalizeMapSettings } from './mapSettings';
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
  ClusterComponentProps,
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
    const settings = normalizeMapSettings(props);
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
    const [shaderReadyRevision, setShaderReadyRevision] = useState<
      number | null
    >(null);
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
    const markerContent = useMemo(
      () => collectMarkers(props.children, Marker),
      [props.children],
    );
    const [markerVersion, setMarkerVersion] = useState({
      signature: markerContent.signature,
      revision: 0,
    });
    if (markerVersion.signature !== markerContent.signature)
      setMarkerVersion({
        signature: markerContent.signature,
        revision: markerVersion.revision + 1,
      });
    const scene = useMemo(
      () =>
        compileScene([
          ...markerContent.content,
          ...markerContent.groups.map((group) => (
            <InternalSource
              key={group.sourceId}
              id={group.sourceId}
              data={group.data}
              revision={markerVersion.revision}
              cluster
            >
              <InternalLayer
                id={group.layerId}
                type="circle"
                style={{ circleRadius: 1, circleOpacity: 0 }}
              />
            </InternalSource>
          )),
        ]),
      [markerContent, markerVersion.revision],
    );
    const [markerLayout, setMarkerLayout] = useState<{
      styleRevision: number;
      layout: MarkerLayout;
    }>();
    const activeMarkers = useRef(markerContent);
    const activeLayout = useRef(markerLayout);
    const activeStyle = useRef(styleRequest.revision);
    useLayoutEffect(() => {
      activeMarkers.current = markerContent;
      activeLayout.current = markerLayout;
      activeStyle.current = styleRequest.revision;
    }, [markerContent, markerLayout, styleRequest.revision]);
    const ClusterComponent = props.clusterComponent ?? DefaultCluster;
    const clusterChildren =
      markerLayout?.styleRevision === styleRequest.revision &&
      markerLayout.layout.sourceRevision === markerVersion.revision
        ? markerLayout.layout.features.map((feature) => {
            if (feature.clusterId === undefined)
              return markerContent.markers.get(feature.id);
            const group = markerContent.groups.find(
              (group) =>
                group.sourceId === (feature.sourceId ?? markerSourceID),
            )!;
            const coordinate = {
              latitude: feature.latitude,
              longitude: feature.longitude,
            };
            const layout = markerLayout.layout;
            const handle = clusterHandles.capture(
              group.sourceId,
              `cluster:${feature.clusterId}`,
              {
                cluster: true,
                cluster_id: feature.clusterId,
                point_count: feature.count!,
              },
              layout.indexRevision,
              styleRequest.revision,
            )!;
            const current = () =>
              readiness.getCapabilities() !== null &&
              activeMarkers.current === markerContent &&
              activeLayout.current?.layout === layout &&
              activeStyle.current === styleRequest.revision;
            const clusterProps: ClusterComponentProps = {
              ...(group.clusterGroup === undefined
                ? {}
                : { clusterGroup: group.clusterGroup }),
              count: feature.count!,
              coordinate,
              getMembers: () =>
                resolveClusterMembers(
                  feature.count!,
                  group.markers,
                  async (offset) => {
                    const page = (await queries.request(
                      'clusterLeaves',
                      clusterHandles.request(handle, styleRequest.revision, {
                        offset,
                        limit: 100,
                      }),
                      styleRequest.revision,
                    )) as NativeClusterPage;
                    return page.features.map((member) => member.featureId);
                  },
                  current,
                ),
              expand: async () => {
                try {
                  if (!current()) throw new Error('Cluster is obsolete');
                  const zoom = (await queries.request(
                    'clusterExpansion',
                    clusterHandles.request(handle, styleRequest.revision),
                    styleRequest.revision,
                  )) as number;
                  if (!current() || !nativeRef.current)
                    throw new Error('Cluster is obsolete');
                  Commands.animateCamera(
                    nativeRef.current,
                    coordinate.latitude,
                    coordinate.longitude,
                    zoom,
                    0,
                    0,
                    300,
                  );
                } catch (error) {
                  props.onError?.({
                    code: 'marker-cluster',
                    message:
                      error instanceof Error
                        ? error.message
                        : 'Cluster expansion failed',
                    fatal: false,
                  });
                  throw error;
                }
              },
            };
            return (
              <Marker
                key={feature.id}
                id={feature.id}
                coordinate={coordinate}
                anchor={{ x: 0.5, y: 0.5 }}
              >
                <ClusterComponent {...clusterProps} />
              </Marker>
            );
          })
        : [];
    useImperativeHandle(
      ref,
      () => ({
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
      [readiness, queries, styleRequest.revision],
    );
    const shaderHost = useMemo(
      () => ({
        ready: shaderReadyRevision === styleRequest.revision,
        revision: styleRequest.revision,
        request(input: Record<string, string | number>) {
          if (!readiness.isReady(styleRequest.revision))
            return Promise.reject(new Error('Map is not ready'));
          return queries.request('shaderLayer', input, styleRequest.revision);
        },
      }),
      [shaderReadyRevision, styleRequest.revision, readiness, queries],
    );
    return (
      <MapContext.Provider value={true}>
        <ShaderMapContext.Provider value={shaderHost}>
          <NativeMap
            {...settings}
            ref={nativeRef}
            style={props.style}
            testID={props.testID}
            styleURL={props.styleURL}
            styleRevision={styleRequest.revision}
            sceneJSON={scene.json}
            onMarkerClusters={({ nativeEvent: e }) => {
              if (
                e.styleRevision !== styleRequest.revision ||
                !readiness.getCapabilities()
              )
                return;
              const layout = parseMarkerLayout(
                e.layoutJSON,
                markerVersion.revision,
              );
              if (
                !layout ||
                layout.features.some(
                  (feature) =>
                    !markerContent.groups.some(
                      (group) =>
                        group.sourceId ===
                          (feature.sourceId ?? markerSourceID) &&
                        (feature.clusterId !== undefined ||
                          group.markers.has(feature.id)),
                    ),
                )
              )
                return;
              if (
                layout.features.reduce(
                  (sum, feature) => sum + (feature.count ?? 1),
                  0,
                ) > markerContent.markers.size
              )
                return;
              setMarkerLayout({ styleRevision: e.styleRevision, layout });
            }}
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
                nativeEvent.subscriptionRevision !==
                  gestureSubscription.revision
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
                setShaderReadyRevision(null);
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
              setShaderReadyRevision(nativeEvent.styleRevision);
              props.onCapabilitiesChange?.(report);
              props.onMapReady?.();
            }}
            onMapError={({ nativeEvent }) => {
              const error = classifyMapError(nativeEvent);
              if (error.fatal) {
                setShaderReadyRevision(null);
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
            {clusterChildren}
          </NativeMap>
        </ShaderMapContext.Provider>
      </MapContext.Provider>
    );
  },
);
