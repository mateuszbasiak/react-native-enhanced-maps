import MapView, { resolveProvider } from '../src/index.js';
import type { Camera, MapViewRef, CameraEvent } from '../src/index.js';
const camera: Camera = { center: { latitude: 52, longitude: 21 }, zoom: 10, heading: 0, pitch: 0 };
<MapView provider="google" initialCamera={camera} onCameraChange={(event: CameraEvent) => { const zoom: number = event.camera.zoom; void zoom; }} />;
declare const map: MapViewRef;
map.animateCamera(camera, 300);
// @ts-expect-error provider spelling must be checked
<MapView provider="mapbox" />;
// @ts-expect-error camera requires coordinates, zoom, heading and pitch
map.animateCamera({ zoom: 5 });
// @ts-expect-error platforms are restricted
resolveProvider('web');
// @ts-expect-error event payload is not a number
<MapView onCameraChange={(event: number) => { void event; }} />;

import type { ExperimentalRasterOverlay } from '../src/index.js';
const raster: ExperimentalRasterOverlay = { width: 1, height: 1, rgbaBase64: '/wAA/w==', bounds: { north: 53, south: 52, west: 20, east: 21 } };
const rasterMap = <MapView experimentalRasterOverlay={raster} />;
void rasterMap;
// @ts-expect-error raster geographic bounds are immutable
raster.bounds.north = 54;
