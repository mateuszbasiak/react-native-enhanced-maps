# Initial contracts

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

The initial MapKit callback reports completed region changes, not frame-level
camera synchronization. No event stream in this spike is suitable evidence that
GPU geographic alignment or JS-independent rendering works.

## Lifetime

Native adapters clear delegates/listeners and release map views during disposal.
Android forwards Activity lifecycle notifications to its SDK view. The exported
JS revision gate invalidates stale revisions after replacement/disposal; it is
not a substitute for native cancellation. Native async dataset work does not exist
yet and will require its own generation/revision guards.

## TypeGPU

The companion exports frame, renderer factory, renderer lifetime, and status types.
There is no rendering surface, GPU pipeline, shader execution, projection matrix,
or picking implementation yet. The eventual API must expose a verified projection
and typed targets, handle device loss, and meet threading/lifecycle acceptance tests.

## Capabilities and compatibility

Capability types distinguish supported, unsupported, and unvalidated. No runtime
capability report is provided yet. Layers and clustering are not exported as fake
components. The complete react-native-maps API inventory and expression specification
remain later contract work; names in the design are requirements, not implemented APIs.
