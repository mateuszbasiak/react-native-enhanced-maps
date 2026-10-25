# Documentation

The current package is `react-native-enhanced-maps`; the repository is
[react-native-maplibre-maps](https://github.com/mateuszbasiak/react-native-maplibre-maps).
The repository rename does not rename npm imports. The package owns MapLibre
Native on iOS/Android and targets React Native's New Architecture.

## Install and use

- [Package installation and native setup](../packages/maps/README.md),
  [isolated bare consumers](native-consumers.md) and [Expo custom builds](expo.md).
- [Public API](../packages/maps/docs/api.md): MapView, Marker, Polyline, Polygon,
  Circle, ref methods, events and exported types. ShaderLayer is a separate entry.
- [Shapes](shapes.md), [marker clustering](clustering.md),
  [camera projection/fitting](map-geometry.md), [camera provenance](camera-origins.md),
  [settings](map-settings.md), [padding](map-padding.md) and [map presses](map-presses.md).
- [Marker synchronization](marker-coordinate-sync.md), [input](marker-gestures.md)
  and [native gestures](gestures.md).
- [Experimental shaders](shader-layer.md) and [runtime capabilities](capabilities.md).
  An implemented feature can still report unvalidated while broader quality
  evidence remains open; the report does not expose all underlying SDK features.
- [Compatibility and unavailable APIs](compatibility.md) and
  [remaining checklist](../FEATURE_CHECKLIST.md).

## Develop and verify

[Development](development.md) describes commands and local builds.
[Consumer footprint](consumer-footprint.md) measures comparable core/shader JS
bundles and installed dependency payloads, separately from native app sizes.
[Optional GPU peer consumers](optional-peer-consumers.md) describes the isolated
installation, declaration and bundling matrix and its native acceptance limits.
[Remote CI acceptance](remote-ci-acceptance.md) records verified workflow runs,
commit provenance, package/bundle artifacts and the limits of those checks.
[Component cluster acceptance](component-cluster-acceptance.md),
[lifecycle acceptance](map-lifecycle-acceptance.md),
[polygon-hole picking](polygon-hole-picking.md) and
[shape layer identity](shape-layer-identity.md) record bounded checks.
The [verification log](verification.md) includes historical results: dates and
implementation context matter. A previous prototype pass is not evidence for a
replacement implementation. Physical-device validation is maintainer-owned
follow-up and does not block feature completion; unperformed checks are not passes.

[Release policy](release-policy.md), [contributing](../CONTRIBUTING.md) and
[security reporting](../SECURITY.md) describe maintenance and distribution policy.
Packages remain private and UNLICENSED; no publication is authorized by these docs.

## Internal and historical records

[Internal layers](layers.md), [source revisions](source-revisions.md),
[scene budgets](scene-budgets.md) and [feature routing](feature-picking.md)
explain private transport and native constraints. They do not add source/layer or
cluster-query exports to the application API.

[Contract references](contracts.md) distinguish current links from earlier provider
contracts. Prototype documents (`*-prototype.md`), [native components](native-components.md)
and the [old layer scenario](layer-scenario.md) retain historical context with
explicit notices. Their Apple/Google provider calls, source descriptors and old
shader transports are not current usage instructions. Local implementation plans
are ignored and are not part of published documentation.
