import React, {
  forwardRef,
  useImperativeHandle,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ElementRef } from 'react';
import { Platform, PixelRatio, View } from 'react-native';
import {
  regionRequest,
  rejectUnsupportedProps,
  createCameraCommandQueue,
  parseRegionEvent,
  mergeCamera,
  cameraDuration,
  fitOptions,
} from './rnMapsCompat';
import { normalizeUserLocation, parseUserLocationEvent } from './userLocation';
import type { UserLocation } from './userLocation';
import { snapshotRequest } from './snapshots';
import { createLocationFollowState } from './locationTracking';
import { Marker } from './Marker';
import { DefaultCluster } from './DefaultCluster';
import {
  collectMarkers,
  markerSourceID,
  parseMarkerLayout,
  resolveClusterMembers,
} from './markerClustering';
import type { MarkerLayout } from './markerClustering';
import { currentMarkerLayout } from './markerLayoutLifetime';
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
export type MapView = MapViewRef;
export const MapView = forwardRef<MapViewRef, MapViewProps>(
  function MapView(props, ref) {
    rejectUnsupportedProps(props, 'MapView');
    if (Platform.OS !== 'ios' && Platform.OS !== 'android')
      throw new Error('MapView supports iOS and Android only');
    if (typeof props.styleURL !== 'string' || !props.styleURL.trim())
      throw new Error('MapView requires styleURL');
    const settings = normalizeMapSettings(props);
    const gestureInterval = validateGestureInterval(
      props.gestureEventIntervalMs,
    );
    const gestureEnabled = Boolean(
      props.onGesture || props.followsUserLocation,
    );
    for (const flag of [props.showsUserLocation, props.followsUserLocation])
      if (flag !== undefined && typeof flag !== 'boolean')
        throw new TypeError(
          'Location visibility and follow flags must be boolean',
        );
    const [locationFollow] = useState(createLocationFollowState);
    locationFollow.configure(
      Boolean(props.showsUserLocation && props.followsUserLocation),
      Boolean(props.camera || props.region),
    );
    const [nativeLocation, setNativeLocation] = useState<{
      revision: number;
      fix: UserLocation;
    }>();
    const suppliedLocation = useMemo(
      () =>
        props.userLocation == null
          ? undefined
          : normalizeUserLocation(props.userLocation),
      [props.userLocation],
    );
    const locationCallback = useRef(props.onUserLocationChange);
    useLayoutEffect(() => {
      locationCallback.current = props.onUserLocationChange;
    }, [props.onUserLocationChange]);
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
    const renderedMarkerLayout = currentMarkerLayout(
      markerLayout,
      styleRequest.revision,
      markerVersion,
      markerContent.signature,
    );
    const clusterChildren = renderedMarkerLayout
      ? renderedMarkerLayout.features.map((feature) => {
          if (feature.clusterId === undefined)
            return markerContent.markers.get(feature.id);
          const group = markerContent.groups.find(
            (group) => group.sourceId === (feature.sourceId ?? markerSourceID),
          )!;
          const coordinate = {
            latitude: feature.latitude,
            longitude: feature.longitude,
          };
          const layout = renderedMarkerLayout;
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
    const [enqueueCamera] = useState(createCameraCommandQueue);
    const controlledSignature = JSON.stringify(
      props.camera ?? props.region ?? null,
    );
    const controlledRequest = useRef({
      signature: controlledSignature,
      revision: styleRequest.revision,
      version: 0,
    });
    if (
      controlledRequest.current.signature !== controlledSignature ||
      controlledRequest.current.revision !== styleRequest.revision
    )
      controlledRequest.current = {
        signature: controlledSignature,
        revision: styleRequest.revision,
        version: controlledRequest.current.version + 1,
      };
    const commandVersion = controlledRequest.current.version;
    const controlledCurrent = () =>
      controlledRequest.current.version === commandVersion;
    const readNativeCamera = async () => {
      if (!readiness.isReady(styleRequest.revision))
        throw new Error('Map is not ready');
      return (await queries.request(
        'camera',
        {},
        styleRequest.revision,
      )) as Camera;
    };
    const getCamera = async () => {
      let camera: Camera | undefined;
      await enqueueCamera(async () => {
        camera = await readNativeCamera();
      });
      return camera!;
    };
    const submitCamera = (
      patch: Partial<Camera>,
      durationMs: number,
      current = () => true,
    ) => {
      mergeCamera(defaultCamera, patch);
      return enqueueCamera(async () => {
        const revision = styleRequest.revision;
        const camera = mergeCamera(await readNativeCamera(), patch);
        if (!current()) return;
        if (!readiness.isReady(revision) || !nativeRef.current)
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
      }, current);
    };
    const fit = async (
      coordinates: readonly Coordinate[] | undefined,
      options: Parameters<MapViewRef['fitCoordinates']>[1],
    ) => {
      if (!readiness.isReady(styleRequest.revision))
        throw new Error('Map is not ready');
      const request = fitRequest(coordinates, options);
      await enqueueCamera(async () => {
        if (!readiness.isReady(styleRequest.revision))
          throw new Error('Map is not ready');
        await queries.request('fit', request, styleRequest.revision);
      });
    };
    const fitRegion = async (
      region: import('./types').Region,
      duration = 300,
      current = () => true,
    ) => {
      if (!readiness.isReady(styleRequest.revision))
        throw new Error('Map is not ready');
      const request = regionRequest(region, duration);
      await enqueueCamera(async () => {
        if (!readiness.isReady(styleRequest.revision))
          throw new Error('Map is not ready');
        await queries.request('fit', request, styleRequest.revision);
      }, current);
    };
    const effectiveLocation =
      props.userLocation === undefined
        ? nativeLocation?.revision === styleRequest.revision
          ? nativeLocation.fix
          : undefined
        : suppliedLocation;
    if (!effectiveLocation) locationFollow.clear();
    useEffect(() => {
      if (props.userLocation !== undefined || !props.showsUserLocation)
        setNativeLocation(undefined);
    }, [props.userLocation, props.showsUserLocation]);
    const locationSignature = JSON.stringify(effectiveLocation ?? null);
    useEffect(() => {
      if (!effectiveLocation || !readiness.isReady(styleRequest.revision))
        return;
      if (props.userLocation !== undefined)
        locationCallback.current?.({
          nativeEvent: { coordinate: effectiveLocation },
        });
      // Location values, rather than parent callback identity, define a new fix.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [locationSignature, shaderReadyRevision, styleRequest.revision]);
    useEffect(() => {
      if (!effectiveLocation || !readiness.isReady(styleRequest.revision))
        return;
      const target = locationFollow.update(effectiveLocation);
      if (target)
        void submitCamera(
          { center: target },
          300,
          () => locationFollow.current() === target,
        ).catch((error) =>
          props.onError?.({
            code: 'location-follow',
            message: String(error),
            fatal: false,
          }),
        );
      // Follow ownership changes can resume a retained fix without re-emitting it.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
      locationSignature,
      props.followsUserLocation,
      props.showsUserLocation,
      controlledSignature,
      shaderReadyRevision,
      styleRequest.revision,
    ]);
    const readGeometry = async (
      kind: 'bounds' | 'point' | 'coordinate',
      input: Record<string, number> = {},
    ) => {
      let result: Awaited<ReturnType<typeof queries.request>>;
      await enqueueCamera(async () => {
        if (!readiness.isReady(styleRequest.revision))
          throw new Error('Map is not ready');
        result = await queries.request(kind, input, styleRequest.revision);
      });
      return result!;
    };
    const initialRegion = useRef(
      props.initialCamera ? undefined : props.initialRegion,
    );
    const lastEmittedRegion = useRef<string | undefined>(undefined);
    const appliedControlled = useRef<string | undefined>(undefined);
    const controlledKey = `${styleRequest.revision}:${controlledSignature}`;
    useEffect(() => {
      if (shaderReadyRevision !== styleRequest.revision) return;
      if (
        !props.camera &&
        props.region &&
        JSON.stringify(props.region) === lastEmittedRegion.current
      ) {
        appliedControlled.current = controlledKey;
        return;
      }
      if (appliedControlled.current === controlledKey) return;
      appliedControlled.current = controlledKey;
      const task = props.camera
        ? submitCamera(props.camera, 0, controlledCurrent)
        : props.region
          ? fitRegion(props.region, 0, controlledCurrent)
          : undefined;
      task?.catch((error) =>
        props.onError?.({
          code: 'camera',
          message: String(error),
          fatal: false,
        }),
      );
      // React value changes, rather than object identity, drive controlled commands.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [controlledSignature, shaderReadyRevision, styleRequest.revision]);
    useImperativeHandle(ref, () => ({
      async takeSnapshot(options) {
        const request = snapshotRequest(options);
        let value: string | undefined;
        await enqueueCamera(async () => {
          if (!readiness.isReady(styleRequest.revision))
            throw new Error('Map is not ready');
          value = (await queries.request(
            'snapshot',
            request,
            styleRequest.revision,
          )) as string;
        });
        return value!;
      },
      async resumeUserLocationFollow() {
        const target = locationFollow.resume();
        if (target)
          await submitCamera(
            { center: target },
            300,
            () => locationFollow.current() === target,
          );
      },
      getCamera,
      setCamera: (patch) => submitCamera(patch, 0),
      animateToRegion: (region, duration = 300) => fitRegion(region, duration),
      fitToCoordinates: (coordinates, options) =>
        fit(coordinates, fitOptions(options)),
      fitToElements: async (options) => {
        if (!readiness.isReady(styleRequest.revision))
          throw new Error('Map is not ready');
        const request = {
          ...fitRequest(undefined, fitOptions(options)),
          markersOnly: 1,
        };
        await enqueueCamera(async () => {
          if (!readiness.isReady(styleRequest.revision))
            throw new Error('Map is not ready');
          await queries.request('fit', request, styleRequest.revision);
        });
      },
      async getMapBoundaries() {
        if (!readiness.isReady(styleRequest.revision))
          throw new Error('Map is not ready');
        const b = (await readGeometry('bounds')) as MapBounds;
        return {
          northEast: { latitude: b.north, longitude: b.east },
          southWest: { latitude: b.south, longitude: b.west },
        };
      },
      fitCoordinates: fit,
      fitElements: (options) =>
        fit(
          undefined,
          options && ('edgePadding' in options || 'animated' in options)
            ? fitOptions(options)
            : options,
        ),
      async pointForCoordinate(coordinate) {
        const value = validateMapCoordinate(coordinate);
        if (!readiness.isReady(styleRequest.revision))
          throw new Error('Map is not ready');
        return (await readGeometry('point', {
          latitude: value.latitude,
          longitude: value.longitude,
        })) as MapPoint;
      },
      async coordinateForPoint(point) {
        const value = validateMapPoint(point);
        if (!readiness.isReady(styleRequest.revision))
          throw new Error('Map is not ready');
        return (await readGeometry('coordinate', {
          x: value.x,
          y: value.y,
        })) as Coordinate;
      },
      async getVisibleBounds() {
        if (!readiness.isReady(styleRequest.revision))
          throw new Error('Map is not ready');
        return (await readGeometry('bounds')) as MapBounds;
      },
      getCapabilities() {
        return readiness.getCapabilities();
      },
      animateCamera(camera, options) {
        const duration = cameraDuration(options);
        void submitCamera(camera, duration).catch((error) =>
          props.onError?.({
            code: 'camera',
            message: String(error),
            fatal: false,
          }),
        );
      },
    }));
    const [shaderViewport, setShaderViewport] = useState({
      width: 0,
      height: 0,
      pixelRatio: PixelRatio.get(),
    });
    const shaderHost = useMemo(
      () => ({
        ready: shaderReadyRevision === styleRequest.revision,
        viewport: shaderViewport,
        revision: styleRequest.revision,
        request(input: Record<string, string | number>) {
          if (!readiness.isReady(styleRequest.revision))
            return Promise.reject(new Error('Map is not ready'));
          return queries.request('shaderLayer', input, styleRequest.revision);
        },
      }),
      [
        shaderReadyRevision,
        styleRequest.revision,
        readiness,
        queries,
        shaderViewport,
      ],
    );
    return (
      <MapContext.Provider value={true}>
        <ShaderMapContext.Provider value={shaderHost}>
          <NativeMap
            {...settings}
            ref={nativeRef}
            style={props.style}
            onLayout={(event) => {
              props.onLayout?.(event);
              const {
                nativeEvent: { layout },
              } = event;
              const width = PixelRatio.getPixelSizeForLayoutSize(layout.width),
                height = PixelRatio.getPixelSizeForLayoutSize(layout.height),
                pixelRatio = PixelRatio.get();
              setShaderViewport((previous) =>
                previous.width === width &&
                previous.height === height &&
                previous.pixelRatio === pixelRatio
                  ? previous
                  : { width, height, pixelRatio },
              );
            }}
            testID={props.testID}
            accessible={props.accessible}
            accessibilityLabel={props.accessibilityLabel}
            accessibilityHint={props.accessibilityHint}
            accessibilityRole={props.accessibilityRole}
            accessibilityState={props.accessibilityState}
            importantForAccessibility={props.importantForAccessibility}
            pointerEvents={props.pointerEvents}
            locationEnabled={Boolean(
              props.showsUserLocation && props.userLocation === undefined,
            )}
            onUserLocation={({ nativeEvent }) => {
              if (
                !readiness.isReady(styleRequest.revision) ||
                props.userLocation !== undefined ||
                !props.showsUserLocation
              )
                return;
              if (nativeEvent.error) {
                props.onError?.({
                  code: 'location-unavailable',
                  message: nativeEvent.error,
                  fatal: false,
                });
                return;
              }
              const event = parseUserLocationEvent(
                nativeEvent,
                styleRequest.revision,
              );
              if (event) {
                setNativeLocation({
                  revision: styleRequest.revision,
                  fix: event.nativeEvent.coordinate,
                });
                props.onUserLocationChange?.(event);
              }
            }}
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
            onMapPress={(nativePress) => {
              const { nativeEvent } = nativePress;
              if (
                nativeEvent.styleRevision !== styleRequest.revision ||
                !readiness.getCapabilities()
              )
                return;
              const event = parseNativeMapPress(nativeEvent);
              if (!event) return;
              const wrapped = {
                ...event,
                stopPropagation: () => nativePress.stopPropagation(),
                nativeEvent: {
                  ...event,
                  action:
                    event.action === 'tap'
                      ? ('press' as const)
                      : ('long-press' as const),
                },
              };
              if (event.action === 'tap') props.onPress?.(wrapped);
              else props.onLongPress?.(wrapped);
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
              if (event) {
                if (event.phase === 'begin') locationFollow.gesture();
                props.onGesture?.(event);
              }
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
              const initial = initialRegion.current;
              initialRegion.current = undefined;
              const setup = props.camera
                ? submitCamera(props.camera, 0, controlledCurrent)
                : props.region
                  ? fitRegion(props.region, 0, controlledCurrent)
                  : initial
                    ? fitRegion(initial, 0, controlledCurrent)
                    : Promise.resolve();
              props.onCapabilitiesChange?.(report);
              void setup
                .then(() => {
                  if (controlledCurrent())
                    appliedControlled.current = controlledKey;
                  if (!readiness.isReady(nativeEvent.styleRevision)) return;
                  setShaderReadyRevision(nativeEvent.styleRevision);
                  props.onMapReady?.();
                })
                .catch((error) => {
                  props.onError?.({
                    code: 'initial-camera',
                    message: String(error),
                    fatal: false,
                  });
                  if (!readiness.isReady(nativeEvent.styleRevision)) return;
                  appliedControlled.current = controlledKey;
                  setShaderReadyRevision(nativeEvent.styleRevision);
                  props.onMapReady?.();
                });
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
            regionEventsEnabled={Boolean(
              props.onRegionChange || props.onRegionChangeComplete,
            )}
            onRegionEvent={({ nativeEvent }) => {
              if (!readiness.isReady(styleRequest.revision)) return;
              const e = parseRegionEvent(nativeEvent, styleRequest.revision);
              if (e) {
                lastEmittedRegion.current = JSON.stringify(e.region);
                (e.complete
                  ? props.onRegionChangeComplete
                  : props.onRegionChange)?.(e.region, e.details);
              }
            }}
            onCameraIdle={({ nativeEvent: e }) => {
              props.onCameraIdle?.({
                camera: {
                  center: { latitude: e.latitude, longitude: e.longitude },
                  zoom: e.zoom,
                  heading: e.heading,
                  pitch: e.pitch,
                },
                origin: normalizeCameraOrigin(e.origin),
              });
            }}
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
            {props.showsUserLocation && effectiveLocation && (
              <Marker
                id="em-cluster:user-location"
                coordinate={effectiveLocation}
                anchor={{ x: 0.5, y: 0.5 }}
                zIndex={1000000}
              >
                <View
                  accessible
                  accessibilityLabel="Your location"
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: 9,
                    backgroundColor: '#1688ff',
                    borderColor: 'white',
                    borderWidth: 3,
                  }}
                />
              </Marker>
            )}
          </NativeMap>
        </ShaderMapContext.Provider>
      </MapContext.Provider>
    );
  },
);
