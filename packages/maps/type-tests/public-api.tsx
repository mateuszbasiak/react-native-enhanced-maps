import MapView, {
  Marker,
  Polyline,
  Polygon,
  Circle,
  UrlTile,
} from '../src/index.js';
<UrlTile
  urlTemplate="https://example.com/{z}/{x}/{y}.png"
  tileSize={512}
  minimumZ={2}
  maximumZ={18}
  opacity={0.5}
  zIndex={1}
/>;
// @ts-expect-error tile templates are required
<UrlTile />;
// @ts-expect-error visibility must be boolean
<UrlTile urlTemplate="https://example.com/{z}/{x}/{y}.png" visible="yes" />;
import type {
  Camera,
  MapViewRef,
  ClusterComponentProps,
  PolygonProps,
} from '../src/index.js';
const camera: Camera = {
  center: { latitude: 52, longitude: 21 },
  zoom: 10,
  heading: 0,
  pitch: 0,
};
declare const map: MapViewRef;
const pointQuery: Promise<Readonly<{ x: number; y: number }>> =
  map.pointForCoordinate(camera.center);
const coordinateQuery: Promise<
  Readonly<{ latitude: number; longitude: number }>
> = map.coordinateForPoint({ x: 10, y: 20 });
const boundsQuery: Promise<
  Readonly<{ north: number; south: number; east: number; west: number }>
> = map.getVisibleBounds();
void pointQuery;
void coordinateQuery;
void boundsQuery;
const fit: Promise<void> = map.fitCoordinates([camera.center], {
  padding: { top: 10, right: 20, bottom: 30, left: 40 },
  durationMs: 0,
});
const elementsFit: Promise<void> = map.fitElements({ padding: 20 });
void fit;
void elementsFit;
// @ts-expect-error padding requires all four edges
map.fitElements({ padding: { top: 10 } });
// @ts-expect-error query coordinates require both numeric axes
map.pointForCoordinate({ latitude: 54 });
// @ts-expect-error point positions are numeric
map.coordinateForPoint({ x: '10', y: 20 });
<MapView
  styleURL="https://example.com/style.json"
  onPress={(event) => {
    const action: 'tap' | 'long-press' = event.action;
    void action;
    void event.coordinate.latitude;
    // @ts-expect-error map press positions are readonly
    event.position.x = 10;
  }}
  onLongPress={(event) => {
    const y: number = event.position.y;
    void y;
  }}
/>;
map.animateCamera(camera, 300);
const capabilities = map.getCapabilities();
if (capabilities) {
  const engine: 'maplibre' = capabilities.engine;
  void engine;
  // @ts-expect-error native capability reports are immutable snapshots
  capabilities.layers.circle = 'supported';
}
<MapView
  styleURL="https://example.com/style.json"
  onCapabilitiesChange={(report) => {
    void report?.layers.line;
  }}
/>;
<MapView styleURL="https://example.com/style.json" initialCamera={camera}>
  <Marker id="m" coordinate={camera.center} zIndex={2}>
    {null}
  </Marker>
</MapView>;
// @ts-expect-error provider is not a MapLibre renderer or basemap selection API
<MapView styleURL="https://example.com/style.json" provider="google" />;
// @ts-expect-error style source must be explicit
<MapView />;
// RN Maps accepts partial camera updates
map.animateCamera({ zoom: 5 });
// @ts-expect-error marker requires a coordinate
<Marker id="m">{null}</Marker>;
// @ts-expect-error zIndex is numeric
<Marker id="m" coordinate={camera.center} zIndex="top">
  {null}
</Marker>;
const CustomCluster = ({
  count,
  coordinate,
  getMembers,
  expand,
}: ClusterComponentProps) => {
  void count;
  void coordinate.latitude;
  getMembers().then((members) => {
    const id: string = members[0]!.id;
    void id;
  });
  void expand;
  return null;
};
<MapView
  styleURL="https://example.com/style.json"
  clusterComponent={CustomCluster}
>
  <Marker
    id="clustered"
    coordinate={camera.center}
    cluster
    data={{ status: 'moving' }}
  >
    {null}
  </Marker>
  <Marker id="independent" coordinate={camera.center} cluster={false}>
    {null}
  </Marker>
</MapView>;
// @ts-expect-error marker clustering is strictly boolean
<Marker id="bad-cluster" coordinate={camera.center} cluster="yes">
  {null}
</Marker>;
// @ts-expect-error source-oriented cluster methods are no longer public
map.getClusterLeaves({});
// @ts-expect-error generic source/layer components are no longer exported
import { GeoJSONSource, Layer } from '../src/index.js';
void GeoJSONSource;
void Layer;

<Circle
  center={camera.center}
  radius={500}
  lineCap="round"
  lineJoin="bevel"
  lineDashPattern={[8, 4]}
  tappable
  onPress={(event) => {
    const latitude: number = event.nativeEvent.coordinate.latitude;
    void latitude;
  }}
/>;
<Polygon
  coordinates={[
    camera.center,
    { latitude: 53, longitude: 22 },
    { latitude: 52, longitude: 22 },
  ]}
  holes={[]}
  miterLimit={4}
/>;
// @ts-expect-error circle radius is required
<Circle center={camera.center} />;
// @ts-expect-error invalid line cap
<Polyline coordinates={[camera.center, camera.center]} lineCap="triangle" />;
// @ts-expect-error unsupported dash phase must not be silently ignored
<Circle center={camera.center} radius={500} lineDashPhase={2} />;

<MapView
  styleURL="https://example.com/style.json"
  gestureEventIntervalMs={50}
  onGesture={(event) => {
    const kind: 'pan' | 'zoom' | 'rotate' | 'tilt' = event.kind;
    const phase: 'begin' | 'update' | 'end' | 'cancel' = event.phase;
    void kind;
    void phase;
    // @ts-expect-error lifecycle samples are readonly
    event.position.x = 10;
  }}
/>;
<MapView
  styleURL="https://example.com/style.json"
  // @ts-expect-error gesture interval is numeric
  gestureEventIntervalMs="fast"
/>;

// Shader entry declarations remain independent of GPU implementation types.
import { ShaderLayer } from '../src/shaders.js';
import type { ShaderGrid } from '../src/shaders.js';
const shaderGrid: ShaderGrid = {
  width: 1,
  height: 1,
  bounds: [18, 54, 19, 55],
  channels: 2,
  projection: 'mercator',
  units: 'm/s',
  interpolation: 'linear',
  values: [8, 2],
};
void shaderGrid;
const shaders = (
  <ShaderLayer
    id="wind"
    shaders={{
      fragment:
        '@fragment fn fragmentMain() -> @location(0) vec4f { return vec4f(0); }',
    }}
    data={shaderGrid}
    resolutionScale={0.75}
    minZoom={8.5}
    maxZoom={18}
    uniforms={(frame) => {
      'worklet';
      return [frame.zoom];
    }}
    simulation={{ byteLength: 32, workgroups: [1] }}
  />
);
const invalidShader = (
  <ShaderLayer
    id="bad"
    shaders={{ fragment: 'shader' }}
    // @ts-expect-error world coverage replaces geographic rectangle props
    bounds={{ north: 1, south: 0, east: 1, west: 0 }}
  />
);
void shaders;
void invalidShader;

const configuredMap = (
  <MapView
    styleURL="https://example.com/style.json"
    scrollEnabled={false}
    zoomEnabled={false}
    rotateEnabled={false}
    pitchEnabled={false}
    showsCompass={false}
    minZoomLevel={4}
    maxZoomLevel={12}
  />
);
void configuredMap;
const invalidSetting = (
  // @ts-expect-error gesture toggles require booleans
  <MapView styleURL="https://example.com/style.json" zoomEnabled="false" />
);
void invalidSetting;

const paddedMap = (
  <MapView
    styleURL="https://example.com/style.json"
    mapPadding={{ top: 20, right: 30, bottom: 40, left: 50 }}
  />
);
const uniformPaddedMap = (
  <MapView styleURL="https://example.com/style.json" mapPadding={12} />
);
void paddedMap;
void uniformPaddedMap;
const incompletePadding = (
  // @ts-expect-error persistent map padding requires all four edges
  <MapView styleURL="https://example.com/style.json" mapPadding={{ top: 20 }} />
);
void incompletePadding;

<Polyline coordinates={[camera.center, camera.center]} geodesic />;
<Polygon
  coordinates={[
    camera.center,
    { latitude: 53, longitude: 22 },
    { latitude: 52, longitude: 22 },
  ]}
  geodesic={false}
/>;
// @ts-expect-error geodesic is strictly boolean
<Polyline coordinates={[camera.center, camera.center]} geodesic="yes" />;
// @ts-expect-error Circle already uses geographic radius and has no geodesic flag
<Circle center={camera.center} radius={500} geodesic />;

<Polyline
  coordinates={[camera.center, camera.center]}
  strokeColors={['red', '#0088ff80']}
/>;
// @ts-expect-error gradient colors are strings
<Polyline coordinates={[camera.center, camera.center]} strokeColors={[1, 2]} />;
const unsupportedPolygonGradient: PolygonProps = {
  coordinates: [camera.center, camera.center, camera.center],
  // @ts-expect-error gradients belong to Polyline, not Polygon
  strokeColors: ['red', 'blue', 'green'],
};
void unsupportedPolygonGradient;
// @ts-expect-error Circle does not accept per-vertex gradient colors
<Circle center={camera.center} radius={500} strokeColors={['red', 'blue']} />;

map.animateCamera({ zoom: 10 }, { duration: 250 });
map.setCamera({ heading: 90 });
map.getCamera().then((camera) => camera.center.latitude);
map.animateToRegion(
  { latitude: 54, longitude: 18, latitudeDelta: 1, longitudeDelta: 2 },
  300,
);
map.fitToCoordinates([camera.center], {
  animated: false,
  edgePadding: { top: 1, left: 2, bottom: 3, right: 4 },
});
<MapView
  styleURL="https://example.com/style.json"
  initialRegion={{
    latitude: 54,
    longitude: 18,
    latitudeDelta: 1,
    longitudeDelta: 2,
  }}
  onPress={(e) => e.nativeEvent.coordinate}
  onRegionChangeComplete={(region, details) => [
    region.latitudeDelta,
    details.isGesture,
  ]}
>
  <Marker
    identifier="boat"
    coordinate={camera.center}
    centerOffset={{ x: 0, y: 2 }}
    onPress={(e) => e.nativeEvent.coordinate}
  />
</MapView>;

const familiarRef: MapView | null = null;
void familiarRef;
<MapView
  styleURL="https://example.com/style.json"
  onLayout={(event) => event.nativeEvent.layout.width}
  pointerEvents="auto"
  accessibilityLabel="Explore map"
  onPress={(event) => event.stopPropagation()}
>
  <Marker
    coordinate={camera.center}
    onPress={(event) => event.stopPropagation()}
  />
</MapView>;

map
  .takeSnapshot({
    width: 320,
    height: 240,
    format: 'jpg',
    quality: 0.8,
    result: 'base64',
  })
  .then((value) => value.length);
map.resumeUserLocationFollow();
<MapView
  styleURL="https://example.com/style.json"
  showsUserLocation
  followsUserLocation
  userLocation={{ latitude: 54, longitude: 18, accuracy: 6 }}
  onUserLocationChange={(event) => event.nativeEvent.coordinate.heading}
>
  <Marker
    coordinate={camera.center}
    draggable
    onDragStart={(event) => event.nativeEvent.coordinate}
    onDrag={(event) => event.nativeEvent.id}
    onDragEnd={(event) => event.nativeEvent.coordinate}
    onDragCancel={(event) => event.nativeEvent.coordinate}
  />
</MapView>;
// @ts-expect-error snapshot format is portable PNG/JPEG only
map.takeSnapshot({ format: 'webp' });

// Callouts share ordinary marker refs and keep custom React children interactive.
import { Callout, MapCallout } from '../src/index.js';
import type {
  MarkerRef,
  MarkerSelectionEvent,
  CalloutPressEvent,
} from '../src/index.js';
import { createRef } from 'react';
import { Text } from 'react-native';
const markerRef = createRef<MarkerRef>();
const calloutExample = (
  <Marker
    ref={markerRef}
    coordinate={camera.center}
    title="Boat"
    description="Moored"
    calloutAnchor={{ x: 0.5, y: 0 }}
    onSelect={(event: MarkerSelectionEvent) => {
      const id: string = event.nativeEvent.id;
      void id;
    }}
    onCalloutPress={(event: CalloutPressEvent) => event.stopPropagation()}
  >
    <Callout tooltip>
      <Text>Boat details</Text>
    </Callout>
  </Marker>
);
void calloutExample;
const aliasCallout = <MapCallout />;
void aliasCallout;
markerRef.current?.showCallout();
markerRef.current?.hideCallout();
// @ts-expect-error callout tooltip is boolean
const invalidCallout = <Callout tooltip="yes" />;
void invalidCallout;
