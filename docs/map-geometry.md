# Native map geometry queries

The ready MapView ref provides three asynchronous SDK-backed queries:

```ts
const point = await map.pointForCoordinate({
  latitude: 54.37,
  longitude: 18.66,
});
const coordinate = await map.coordinateForPoint(point);
const bounds = await map.getVisibleBounds();
```

Points are relative to the map in logical points, independent of screen density.
Offscreen points are allowed. Coordinate inputs must be finite and within latitude
[-90,90] and longitude [-180,180]. Inverse coordinates and bounds preserve the
SDK's wrapping semantics: longitudes may be unwrapped, and an antimeridian-crossing
envelope may have east less than west. Bounds contain north/south/east/west and
represent the SDK's geographic viewport envelope, not a screen-aligned polygon.

Queries use the current native projection, including heading and pitch, rather
than reconstructing it in JS. They observe the map when the UI-thread command is
processed; separate calls are not an atomic snapshot during camera animation.
Some offscreen/sky/polar positions cannot be projected; invalid native results
reject instead of returning invented coordinates.

Methods reject before readiness, after unmount, on a style change or fatal map
error, or if a native operation fails. Each map allows at most 32 pending queries,
with a 5-second response timeout. Native result payloads are bounded to 2048
characters and validated. Duplicate/obsolete responses cannot resolve newer
requests, and style replacement invalidates pending work. Await/catch the returned
promises. Query failures do not make the ordinary map unusable.

## Camera fitting

```ts
await map.fitCoordinates(coordinates, {
  padding: { top: 20, right: 30, bottom: 40, left: 50 },
  durationMs: 300,
});
await map.fitElements({ padding: 24 });
```

Fit promises acknowledge native command acceptance, not animation completion.
Explicit inputs contain 1–1000 valid coordinates. Padding is either one number or
four logical-point edges (each 0–100000); duration is 0–60000ms, default 300ms.
Default padding is zero. Padding must leave a positive native viewport.

`fitElements` gathers accepted package GeoJSON source geometry and mounted marker
anchors. It excludes rejected candidate source updates and basemap features.
An empty collection rejects. Native traversal is bounded to 100000 positions and
32 nesting levels. Serialized requests are limited to 64KiB of UTF-8; results
retain the query limits above.

Fitting preserves heading/pitch and uses the shortest longitude arc. Native SDK
fitting is followed by bounded projection checks and conservative zoom reductions
to contain the geographic bounds within padding. Up to 16 subsequent zoom-in
checks tighten an excessively wide SDK seed, retaining only a verified camera.
It does not promise the globally optimal camera center or maximum possible zoom.
Invalid or uncontainable fits reject and restore the prior camera.
Accepted fits use application camera provenance and share query cancellation and
timeout behavior.

CAM-09 remains a prototype. The complete geographic, high-pitch, resize,
animation-interruption and physical-device matrix remains open. Preflight camera
changes occur synchronously; absence of intermediate rendered frames has not
been established by simulator checks.
