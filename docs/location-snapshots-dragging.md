# Location, snapshots and draggable markers

These APIs extend the common RN Maps migration surface. They require rebuilt
native apps and the package's supported Fabric runtime.

## User location and following

```tsx
<MapView
  styleURL={styleURL}
  showsUserLocation
  followsUserLocation
  userLocation={appLocation}
  onUserLocationChange={({ nativeEvent }) => {
    console.log(nativeEvent.coordinate);
  }}
/>
```

`userLocation` accepts latitude/longitude and optional accuracy (meters), altitude
(meters), heading (degrees in [0,360)), speed (nonnegative meters/second) and
Unix-millisecond timestamp. The map displays a blue location dot. Accuracy and
heading are event metadata; an accuracy circle and directional puck are not
rendered in this version. App-supplied fixes do not start a second native watcher.

Omit `userLocation` to use the foreground native watcher when `showsUserLocation`
is true. Explicit `null` hides the dot, disables native watching and clears the
retained follow target. Hiding user location also disables following. Native
fixes are discarded when stale (older than 30 seconds), malformed or out of order.
The native watcher pauses on background/detach and closes on disposal.

The application owns permission requests. The map never opens an authorization
prompt. On iOS, configure a nonempty `NSLocationWhenInUseUsageDescription` and
obtain authorization before enabling native location. On Android, declare and
grant coarse and/or fine location permission; approximate/network fixes are
supported when the platform supplies them. No Google location dependency is
required. Missing/revoked permission and unavailable providers report recoverable
`location-*` errors through `onError`; ordinary map interaction remains usable.

Following preserves zoom, heading and pitch. Controlled `camera` or `region`
props take precedence. A recognized map gesture interrupts following; new fixes
continue updating the dot and callbacks without recentering. Call
`mapRef.current.resumeUserLocationFollow()` to resume using the latest valid fix,
or toggle following off and on across renders. Clearing the location invalidates
queued follow commands; resuming without a fix does not move the camera.

## Snapshots

```ts
const uri = await mapRef.current.takeSnapshot({
  width: 1024,
  height: 768,
  format: 'png',
  result: 'file',
});
```

`takeSnapshot` captures the mounted, ready viewport. It includes basemap, public
shapes, ordinary markers and the visible location dot. It rejects while a
`ShaderLayer` is attached; shader capture is not silently omitted. Arbitrary
React siblings outside the map are not included. SDK controls can appear on
Android; attribution/logo composition is platform-specific, with static source
credits included in the output. Keep attribution when sharing or transforming
exports.

Options are `width`, `height`, `format: 'png' | 'jpg'`, `quality` within [0,1],
and `result: 'file' | 'base64'`. Defaults are PNG, quality 1 and file output.
Dimensions are physical pixels; omitting both uses the native viewport size,
while omitting one preserves its aspect ratio. Supplying both resizes the
captured viewport and can stretch it if the aspect ratio differs.

The bounds are 4096 pixels per dimension, 16,000,000 pixels total and 32 MiB
encoded output. Very small exports can reject if readable attribution cannot
fit. Offscreen/unmounted maps and alternate `region` captures are unsupported.
On iOS, simultaneous pitch and map/camera padding reject explicitly because
that off-center perspective has not passed snapshot alignment acceptance; use a
flat camera or clear padding. Native resource loading/encoding times out after
four seconds. Style replacement, detach and disposal invalidate pending output;
catch promise rejections.

A file result is a `file://` URI in private application cache. The package retains
at most 16 snapshot files, pruning files older than 24 hours on subsequent
captures. Copy files needed for persistent storage or deferred sharing. Base64
results contain only encoded image bytes, without a data-URL prefix.

## Marker dragging

```tsx
<Marker
  identifier="route-waypoint"
  coordinate={waypoint}
  draggable
  onDragStart={({ nativeEvent }) => console.log(nativeEvent.coordinate)}
  onDrag={({ nativeEvent }) => setWaypoint(nativeEvent.coordinate)}
  onDragEnd={({ nativeEvent }) => setWaypoint(nativeEvent.coordinate)}
  onDragCancel={({ nativeEvent }) =>
    console.log('Cancelled', nativeEvent.coordinate)
  }
/>
```

A long press begins dragging. Native code owns movement and keeps the finger's
initial offset from the marker anchor. Map gestures do not move the camera during
the drag. Drag callbacks carry `nativeEvent.coordinate` and `nativeEvent.id`;
`onDragCancel` is an extension for explicit cancellation. A completed drag does
not also fire a marker press.

Coordinate prop updates during a drag update the cancellation target without
interrupting native movement, so ordinary `onDrag => setCoordinate` echoes work.
Cancellation restores the latest prop coordinate. Successful completion retains
the native endpoint until the application changes the coordinate value; later
marker presses report that retained endpoint even without a prop update.
Disabling dragging, backgrounding, detaching, removal or style replacement cancels
an active session. Stale events from old sessions/revisions are ignored.

A draggable marker must opt out of clustering with `cluster={false}` when using
a cluster group. Moving an indexed clustered input independently would make its
membership inconsistent, so that combination rejects explicitly. Existing anchor,
offset, image/custom children and child input remain supported.

## Verification

Run `METRO_PORT=8090 npm run verify:rn-maps -- --features <logicalDeviceId>`
against an isolated Debug example. The feature suite checks supplied fixes,
following/controlled precedence, image signatures/file output, invalid options,
null source selection and location exclusion from marker fitting. Touch gestures,
permission transitions and native simulated fixes are separate bounded checks;
see [verification](verification.md). Physical-device acceptance remains
maintainer-owned follow-up.
