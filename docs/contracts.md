# Current contract references

The public component API is `MapView`, `Marker`, `Callout`, `Polyline`, `Polygon` and `Circle`.
Experimental `ShaderLayer` is a separate `/shaders` entry point. MapLibre Native
is the only engine. Public source/layer descriptors and source-oriented cluster
queries have been retired; their contracts remain internal implementation records.

Current contracts and acceptance limits:

- [Camera provenance](camera-origins.md), [projection and fitting](map-geometry.md),
  [map presses](map-presses.md) and [gestures](gestures.md).
- [Shapes](shapes.md), [marker synchronization](marker-coordinate-sync.md) and
  [marker input](marker-gestures.md) and [callouts](marker-callouts.md).
- [Component clustering](clustering.md) and
  [current package API](../packages/maps/README.md).
- [ShaderLayer](shader-layer.md), [capabilities](capabilities.md),
  [scene budgets](scene-budgets.md) and [internal source revisions](source-revisions.md).

Controlled camera props, animation completion promises, user location, snapshots,
image pins, dragging and React callouts are implemented. See the
[RN Maps migration guide](rn-maps-migration.md) and
[location/snapshot/drag contract](location-snapshots-dragging.md) for limits.
Broad RN Maps parity remains incomplete.
See the [checklist](../FEATURE_CHECKLIST.md) for unresolved contracts and gates.

The following record documents retired provider and TypeGPU experiments; it is
preserved for historical context and does not describe the current public API.

---

> Historical prototype record. Apple/Google experiments were removed in the package-owned MapLibre migration. See the root README and package source for the current API; earlier verification does not verify the migrated native implementation.

# Historical initial contracts

All contracts are provisional until three-provider feasibility is measured.

## MapView

Supports iOS and Android only. Defaults to Apple on iOS and Google on Android.
Apple on Android and invalid JS provider/platform values throw explicitly.
`initialCamera` is mount-only. Changing provider requires remounting the view;
controlled camera/region props have not been implemented.

The camera contains center latitude/longitude in degrees, zoom, heading, and pitch.
The public boundary rejects non-finite numbers, latitudes outside [-90, 90],
longitudes outside [-180, 180], zoom outside [0, 24], pitch outside [0, 90], and
invalid animation durations. SDK-specific camera limits can clamp values. The
MapKit zoom-to-distance conversion is provisional, not Google projection parity.

`animateCamera` throws before readiness; it currently returns void and does not
report animation completion. MapKit may choose its own animation timing.

`onMapReady` is backed by native loading/render callbacks. `onError` carries a code, a redacted message, and a fatal flag. Recoverable
map-content failures preserve existing command readiness; initialization failures
invalidate it. Invalid Google authentication is not necessarily exposed
as an SDK callback; use native logs and a future scenario timeout rather than
assuming map readiness.

Camera events contain coordinates, zoom, heading, pitch, and provenance.
Google distinguishes gesture/application/SDK movement where public APIs permit.
MapKit currently reports application movement or unknown. Detailed native pan,
pinch, rotate, tilt and cancellation contracts remain unimplemented.

All three adapters use the same camera event contract. `onCameraChange` receives
continuous samples at most once per `cameraEventIntervalMs` (default 100 ms,
range 16–1000 ms), plus an immediate final snapshot. `onCameraIdle` receives one
event when a movement completes. SDK initialization can also cause movements.
Omit `onCameraChange` for end-only delivery through `onCameraIdle`. Native adapters
skip change-event payload construction when there is no change subscriber.
The final snapshot bypasses the interval limit. These callbacks are not frame-level
GPU synchronization or evidence of geographic shader alignment.

## Lifetime

Native adapters clear delegates/listeners and release map views during disposal.
Android forwards Activity lifecycle notifications to its SDK view. The exported
JS revision gate invalidates stale revisions after replacement/disposal; it is
not a substitute for native cancellation. Native async dataset work does not exist
yet and will require its own generation/revision guards.

## Map content components

`Polyline` and `Polygon` are standalone MapView descriptors backed by native SDK
shapes. Each owns an ID, visibility, opacity and zIndex. Increasing zIndex requests
later drawing; ties retain declaration order, subject to provider rendering groups.
There is no universal ordering across basemap content, markers, raster and shapes.
Geometry is immutable and stable references avoid repeat source serialization.
See [native-components.md](native-components.md). Heatmap/particles and shape
picking remain planned. The shared custom renderer was removed.

## Historical TypeGPU experiment (removed)

The following describes the retired Apple/Google raster experiment. Its companion
package, exported raster types and readback helpers were removed after the switch
to the react-native-webgpu shared-output prototype. See [current GPU direction](shader-layer-api.md).

The optional companion now includes an experimental one-shot TypeGPU triangle
renderer with typed RGBA uniforms and bounded RGBA8 readback. Core accepts
`experimentalRasterOverlay`: one immutable image, dimensions 1–256, ordered bounds
within ±85 latitude, at most 180 longitude span without antimeridian crossing.
Google uses native ground overlays; Apple uses MKOverlayRenderer above roads.
Transparency and camera projection are SDK-owned; overlay touches pass through.
Replacing/removing the prop replaces/removes the native image. Invalid raster
errors are recoverable and do not invalidate map readiness.

This proves a static shader-to-geographic-raster path only. It does not implement
live GPU shader animation, a native WebGPU render hook, portable projection
matrices, shared depth, arbitrary style-layer insertion, or picking. The exported
frame/lifetime interfaces remain provisional contracts for future live rendering.

## Capabilities and compatibility

Capability types distinguish supported, unsupported, and unvalidated. No runtime
capability report is provided yet. Only the implemented GeoJSON/line/fill layer components are exported; clustering
and other rendering kinds remain unimplemented. The complete react-native-maps API inventory and expression specification
remain later contract work; names in the design are requirements, not implemented APIs.

## Current MapLibre source revisions

Explicit private source `revision` values cross the native boundary and are enforced
by both hosts before scene replacement. Omitted revisions remain unversioned.
See [source revision semantics](source-revisions.md) for rejection, reload and
removal behavior. Earlier provider-specific contracts above remain historical.
