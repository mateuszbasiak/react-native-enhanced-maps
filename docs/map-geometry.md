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
Explicit inputs contain a nonempty dense array of valid coordinates with no fixed
count cap. Explicit fit requests have no serialized-byte cap; other map queries
retain their 64 KiB request bound. Fitting accepted scene geometry also has no
fixed position-count cap. Missing array
entries (including an entirely sparse array) reject before native dispatch instead
of serializing as `null`. Coordinate order is preserved and inputs are copied,
including frozen arrays/objects. Padding is either one number or
four logical-point edges (each 0–100000); duration is 0–60000ms, default 300ms.
Default padding is zero. Padding must leave a positive native viewport.

`fitElements` gathers accepted package GeoJSON source geometry and mounted marker
anchors. It excludes rejected candidate source updates and basemap features.
Accepted generated shapes may contain continuous longitudes beyond ±180°.
The fitter normalizes those world copies before choosing the shortest arc;
explicit fit coordinates and mounted marker anchors remain geographic.
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

## Fit request validation — 2026-10-25

Host regression tests reproduced a sparse-array gap in explicit fit requests:
`Array.map` skipped missing entries and JSON serialization emitted `null` points.
The request builder now validates every array index before serializing. Tests
cover gaps at the first/middle/last position and the 1000-point limit, an entirely
sparse collection, malformed elements, frozen input and ordered boundary values.
The count and fit-request byte caps described in that historical run have since
been removed; padding, duration and nesting validation remain.

This is JavaScript request validation only. It does not add native fit, projection,
viewport, animation or lifecycle acceptance beyond the separately recorded
checks. No simulator or native application build is required for this input fix.

## Generated dateline fits — 2026-10-27

Both native collectors previously rejected accepted generated shape longitudes
beyond ±180°, causing `fitElements` to reject with `Invalid fit coordinate`.
The source-geometry traversal now normalizes finite world-copy longitudes while
explicit inputs retain their bounds. Java and C++ regression tests exercise
positive/negative copies, multiple worlds, canonical boundaries and nonfinite
rejections.

The Debug **Dateline fits** scenario uses public Circle, geodesic Polyline and
Polygon components and the public `fitElements` ref. iOS 26.1 (iPhone 17 Pro)
and Android 16/API 36 ARM64 each pass all three fits with 40-point padding,
projected sample points inside that padding and a camera centered on the dateline
arc. An explicit longitude of 181° still rejects. Both Debug native builds pass.
This covers the reproduced collector failure; the broader heading/pitch,
resize and interruption matrix above remains open. Physical-device validation
is maintainer-owned follow-up.
