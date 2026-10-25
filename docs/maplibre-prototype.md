# MapLibre example

The current example consumes public `MapView`, `Marker`, `Polyline`, `Polygon`
and `Circle` exports. MapLibre Native is owned by the package; earlier wrapper,
Apple/Google provider and public source/layer experiments are historical.

The native layers screen uses public components to display a route, polygon/hole,
circles and fleet markers with 100/1000/10000 requested points. Controls change
point count/visibility, move the camera, compare geodesic shapes and remount the
map. The custom markers screen exercises React Native children, state updates,
Pressable, PanResponder and zIndex. These are functional scenarios, not benchmark
results or a claim that every large-content case meets a performance budget.

Debug navigation also exposes settings, runtime verification, clustering,
lifecycle and shape-picking fixtures. Consult each contract/result document for
its controls and bounded acceptance evidence. Historical `provider(...)` and
source/layer controls do not describe the current example.

Run `npm run example:pods`, start Metro with `npm start` (8088), then launch either
native example. iOS SDK setup belongs to the package's MapLibre SPM hook; Android
links the SDK directly. No Google credentials are needed. See
[development](development.md), [public API](../packages/maps/docs/api.md) and
[remaining work](../FEATURE_CHECKLIST.md).
