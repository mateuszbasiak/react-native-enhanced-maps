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

## Shared native helper corpus — 2026-10-25

`tests/polygon-helper-parity.test.mjs` compiles thin stdin adapters around the
production iOS C++ and Android Java helpers and sends the same 1,164 fixtures to
each binary. Each result is compared with an expected value, rather than merely
checking that the platforms agree. The corpus includes:

- Local, dateline/unwrapped, northern 80–85° and southern −85–−80° rectangles,
  with exterior/hole edges and corners, filled areas and exterior misses.
- Independent reversal of exterior and hole winding, and query world copies
  from −720° through +720° shifts. Hole boundaries remain excluded from fill;
  exterior boundaries remain included.
- 512 reproducible rectangle/hole samples from seed `0x5eeda11`. Expected hits
  use direct numeric interval membership, not a copy of either helper's
  Mercator projection or ray-casting algorithm.
- Nonfinite queries/vertices, out-of-range latitude, empty/short/open rings,
  malformed holes and an excessive world-span case, all expected to reject.

Both helpers passed all 1,164 cases. Temporarily inverting each adapter's boolean
output made the suite fail with the corresponding platform/fixture label; both
adapters were then restored and the suite passed again. Helper execution has a
10-second timeout so a broken malformed-input guard cannot hang indefinitely.
The adapters contain no alternative geometry implementation.

Run `node --test tests/polygon-helper-parity.test.mjs` with the repository's
supported Node version, `javac`/`java` and a C++17 compiler. The test also runs
through the existing `npm run test:contracts` and package CI checks.

This is host-side helper coverage only. It does not verify MapLibre's returned
SDK geometry, native JSON/bridge parsing, multi-polygon component traversal,
rendering, projected tap targeting, outline hit width, draw/hit fall-through or
cross-platform application behavior. Arbitrary polygon topology and near-edge
floating-point tolerances remain outside this rectangle corpus. Native rendering
and picking matrices under SRC-05/06 and PICK-02/03 remain open. No simulator,
physical device or native application build was used for this slice.
