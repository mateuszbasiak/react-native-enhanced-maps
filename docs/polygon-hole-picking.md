# Polygon-hole picking

The pinned MapLibre SDKs (Android 13.6.1, iOS 6.31.0) can return a fill
candidate when the tapped point is inside a polygon hole. Both simulators
reproduced the defect. [MapLibre Native #4783](https://github.com/maplibre/maplibre-native/issues/4783)
reports the same behavior on Android 13.7.1 and iOS 6.31.0; the Android version
in that report is different from this repository's pin.

Native fill selection now checks returned Polygon/MultiPolygon geometry before
accepting a candidate. Matching Java and C++ helpers project into Mercator and
subtract interior rings independent of winding. Explicit unwrapped longitudes
and applicable query world copies are preserved. A rejected candidate allows the
next candidate and lower interactive layers to win, then ordinary map press if
none remains. Filtering only in a JavaScript callback would lose that fall-through.

Hole boundaries are excluded from fill. Rendered outline layers retain their
existing line picking, including their stroke width. Simple polygons without
holes and non-fill layers retain SDK picking behavior. For multipolygons with
holes, another containing component can still accept the point. Invalid or
unbounded geometry queries fail closed in the helper.

## Verification, 2026-10-24

Full local CI passed 87 contracts, declarations/typechecks, native helper tests,
Codegen, packed-package checks and both production bundles. Java and C++ fixtures
cover filled area, holes, boundaries, reversed winding, multiple holes,
antimeridian/unwrapped world copies, wide exteriors and invalid input.
Both native Debug builds passed.

The Debug example's “Open shape picking” fixture uses public Polygon components
and pointForCoordinate to target geographic controls. On iPhone 17 Pro / iOS 26.1
and a temporary Pixel 9a ARM64 / API 36 emulator:

- A hole tap with an underlay selected the lower polygon.
- Removing the underlay preserved the upper polygon and its filled-area press.
- A hole tap without an underlay emitted an ordinary map press.
- Enabling the outline kept its hole edge selectable.

The final probe-free Android build also passed a hole-interior map press with
the outline enabled. Both hosts reported readiness and no fixture error.
The fixture exposes only a bounded latest result and configuration through the
Debug-only `__enhancedMapsShapePicking` helper; remount resets the map instance.

Runtime binaries contain this native filter. JavaScript also includes the
[stable shape-layer identity fix](shape-layer-identity.md), which is required to
keep the upper fill rendered when removing its preceding sibling. The fixes are
separate PRs with that dependency visible through `gh stack`.

This completes the bounded hole-fill regression. Broader visibility, ordering,
geometry replacement, accessibility and hit-cost fixtures remain checklist work.
Physical-device validation is maintainer-owned follow-up and does not block this
feature's completion. No physical-device or production-performance pass is claimed.
