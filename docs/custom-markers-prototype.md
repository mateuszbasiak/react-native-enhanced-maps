> Historical wrapper prototype record. Its patch installer was removed; current native logic lives in packages/maps/android and packages/maps/ios. Google and Apple experiments have been scrapped. Earlier device results do not verify the package migration.

# Live custom markers

The example's **Custom markers** screen accepts regular React Native children,
including normal Pressables and a PanResponder slider. There is no custom marker
gesture wrapper API. State, props, layout, timers and animation remain in React
Native. This is an example-only adapter, not a public package API.

## Android: pixels rendered inside the map

The old live Android view overlay could present a different camera frame from
MapLibre. Updating projected positions earlier was tested and reverted: it could
put the view ahead of the map instead of synchronizing it.

Prototype markers now capture their mounted React subtree on the UI thread and
publish changed pixels as a MapLibre style image. A viewport-aligned SymbolLayer
anchors that image to a GeoJSON coordinate. Both the red reference dot and marker
pixels use the map renderer's camera transform in the same render pass, eliminating
independent overlay movement during pan, zoom, bearing and pitch changes.

The original React views remain mounted for layout, state, accessibility and
standard responder handlers. Their Android drawing is suppressed, with explicit
invalidation to clear previously cached display lists. Input bounds are refreshed
at touch down. Transformed descendants outside unclipped parents are included in
the captured bounds; the image offset preserves the original layout anchor.

Two bitmap buffers are reused per marker. Descendant redraws, layout requests and
child insertion/removal advance a dirty revision. A lightweight native frame check
coalesces those changes: only dirty subtrees are drawn into a bitmap and compared;
only changed images are uploaded. Camera movement does not dirty the subtree.
Style replacement can re-upload the existing bitmap without drawing it again. Hidden
content hides its symbol; removal releases image/source/layer and buffers; map
destruction removes capture callbacks before destroying the SDK. Style replacement
recreates the resources. Resource ownership uses identity because marker geometry
is mutable.

## iOS

The existing live annotation implementation stays in place. MapLibre reparents
the annotation but leaves an empty Fabric host behind. Empty prototype hosts pass
touches through so they cannot cover marker buttons. Child taps and long presses
were verified after moving the map.

## Verification and limits

Android ARM64 emulator, Pixel 9a/API 36: native build, workspace checks (53 tests),
and platform bundles passed. Recorded pan frames show a single marker copy with
its ring aligned to the GPU reference dot. In the sampled counter-anchor frames,
maximum detected center separation changed from about 58 physical pixels in the
baseline recording to 0.32 pixels in the final recording (272 detected final
frames). This is a compressed emulator-video measurement, not a device-wide frame
latency or performance guarantee. Rotation/pitch recording was visually checked.
Pan gestures were recorded in `.argent/flows/android-marker-pan.yaml`.

Counter press/long press, timer updates, prop/color changes, resizing, removal,
re-addition and map remounting were exercised. The child slider receives standard
PanResponder events, but the existing map/child gesture ownership race can still
move the map during a drag; visual synchronization does not solve that separate
input-arbitration issue. RNGH has not been validated.

A native frame callback still checks metadata/dirty revisions for mounted markers,
but clean markers perform no bitmap drawing, comparison, or upload. Animated
children still require captures on changing frames. This is intended for a small
number of rich markers, not thousands of animated React subtrees. Software Canvas capture cannot reproduce independently composed
SurfaceView/video/GL content or hardware elevation shadows. Native marker zIndex
is not exposed by the adapter; symbol draw order follows layer insertion order.
Overlapping interactive markers need further draw-order/hit-order integration.

The version-pinned postinstall patch is
`scripts/patch-maplibre-marker-ios.mjs`; the maintained renderer source is
`scripts/native/EMMarkerTexture.kt`. Prototype behavior is gated to `em-live-`
marker IDs. Google tile experiment has been removed.

Dirty-capture validation on Android: after initial capture, idle markers and a
native camera bearing/pitch animation produced no further capture/upload events.
A one-second timer produced approximately one capture/upload per tick; native
Animated opacity produced changing frames while the other marker stayed at its
initial capture. Resizing and prop/color changes remained visible. Optional
counters can be enabled with `adb shell setprop log.tag.EMMarkerTexture DEBUG`
and inspected with `adb logcat -s EMMarkerTexture:D`; logging is off by default.
