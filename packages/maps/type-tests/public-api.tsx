import MapView, { Marker, Polyline, Polygon, Circle } from '../src/index.js';
import type {
  Camera,
  MapViewRef,
  ClusterComponentProps,
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
// @ts-expect-error camera requires all fields
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
