import MapView, {
  Marker,
  GeoJSONSource,
  Layer,
  Polyline,
  Polygon,
  Circle,
} from '../src/index.js';
import type { Camera, MapViewRef, GeoJSONData } from '../src/index.js';
import type { ClusterOptions } from '../src/index.js';
const clustering: ClusterOptions = { radius: 50, maxZoom: 14, minPoints: 2 };
<GeoJSONSource
  id="clustered"
  data={{ type: 'FeatureCollection', features: [] }}
  cluster={clustering}
>
  <Layer id="clusters" type="circle" clusterFilter="clusters" />
  <Layer id="points" type="circle" clusterFilter="points" />
</GeoJSONSource>;
<GeoJSONSource
  id="bad"
  data={{ type: 'FeatureCollection', features: [] }}
  // @ts-expect-error clustering is not a string
  cluster="yes"
/>;
// @ts-expect-error unsupported cluster filter
<Layer id="bad-filter" type="circle" clusterFilter="all" />;
const camera: Camera = {
  center: { latitude: 52, longitude: 21 },
  zoom: 10,
  heading: 0,
  pitch: 0,
};
declare const map: MapViewRef;
declare const cluster: import('../src/index.js').ClusterHandle;
const clusterChildren: Promise<import('../src/index.js').ClusterPage> =
  map.getClusterChildren(cluster);
const clusterLeaves = map.getClusterLeaves(cluster, { limit: 2, offset: 2 });
const clusterZoom: Promise<number> = map.getClusterExpansionZoom(cluster);
void clusterChildren;
void clusterLeaves;
void clusterZoom;
// @ts-expect-error cluster handles are opaque
map.getClusterLeaves({ sourceId: 'points', id: 1, pointCount: 2 });
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
// @ts-expect-error camera requires all fields
map.animateCamera({ zoom: 5 });
// @ts-expect-error marker requires a coordinate
<Marker id="m">{null}</Marker>;
// @ts-expect-error zIndex is numeric
<Marker id="m" coordinate={camera.center} zIndex="top">
  {null}
</Marker>;
const data: GeoJSONData = { type: 'FeatureCollection', features: [] };
<GeoJSONSource
  id="hits"
  data={data}
  onPress={(id) => {
    const value: string = id;
    void value;
  }}
  onFeaturePress={(hit) => {
    const layer: string = hit.layerId;
    const source: string = hit.sourceId;
    const latitude: number = hit.coordinate.latitude;
    void layer;
    void source;
    void latitude;
    void hit.properties;
    // @ts-expect-error hit snapshots are readonly
    hit.position.x = 1;
  }}
/>;
<MapView styleURL="https://example.com/style.json">
  <GeoJSONSource id="points" data={data}>
    <Layer
      id="dots"
      type="circle"
      style={{ circleColor: '#ff0000', circleRadius: 6 }}
    />
  </GeoJSONSource>
  <Polyline
    id="route"
    coordinates={[camera.center, { latitude: 53, longitude: 22 }]}
  />
</MapView>;

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
