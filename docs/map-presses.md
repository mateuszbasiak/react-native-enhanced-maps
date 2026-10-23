# Map tap and long-press callbacks

`MapView.onPress` receives a confirmed single tap that does not hit an interactive
feature. `MapView.onLongPress` receives one native long-press event, including over
an interactive feature. A long press does not select that feature. Both callbacks
receive `{ action, coordinate, position }`, with action `tap` or `long-press`,
geographic tap location, and a map-relative logical-point position.

Interactive feature taps go to GeoJSONSource or shape callbacks instead of the
background callback. This lets applications use background taps to clear selection
without also clearing each new feature selection. A noninteractive visual feature
does not consume the background tap. Marker child controls keep their own input
and do not dispatch map presses.

Double-tap and continuous quick zoom remain native SDK camera interactions and do
not dispatch single taps. iOS long press uses a 500 ms native recognizer; Android
uses the system/SDK long-press timing. These are native recognition thresholds,
not a promise of identical wall-clock delivery latency.

Events carry the ready style revision internally. Loading/obsolete events and
malformed coordinates are discarded before callbacks. Native payload construction
is disabled when neither callback is supplied; Android discrete events are not
coalesced. Removing callbacks stops delivery without disabling map navigation.
These callbacks do not expose gesture cancellation or consume SDK camera control.
