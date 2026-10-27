# Scene input budgets

The package rejects oversized scenes rather than truncating data. `compileScene`
checks the whole scene, including GeoJSON sources and generated Polyline/Polygon/
Circle sources, before returning native props:

- At most 64 sources and 128 layers.
- At most 50,000 declared coordinate positions across all sources.
- At most 100,000 positions weighted by layer references. Referencing a 25,000-point
  source from four layers uses the whole rendered-position budget, including hidden
  layers, which still consume scene resources.
- At most 4 MiB of UTF-8 serialized scene JSON, including feature properties and
  layer definitions. Multibyte Unicode counts as encoded bytes rather than UTF-16
  code units. Android and iOS independently reject this size before native JSON
  parsing or resource replacement, with recoverable `layer-scene` errors.

Existing per-source feature/property/geometry validation and the separate 64-shape/
10,000-shape-position limits still apply. Geographic circles contribute their
generated ring points, and a fill plus stroke counts its coordinates twice toward
the rendered-position budget. Shape antimeridian handling is unchanged.

Data is immutable. Position counts are weakly cached by data identity; replace
arrays/objects when geometry changes and increase an explicit source revision.
These limits bound input work and transport, not frame time or total memory. Both
native hosts still rebuild scene resources and Android inline tiling runs
synchronously. Worker indexing, incremental patches and release-device budgets
remain separate work.

## Malformed GeoJSON and geographic fixtures

The internal source compiler requires dense coordinate arrays at every geometry
level and finite two-number `[longitude, latitude]` positions within ±180°/±90°.
Missing tuple axes, positions, lines, rings (including holes), or polygons reject
before JSON serialization; JavaScript sparse arrays must not silently turn into
native `null` coordinates. Polygon rings must be closed. Sources/layers remain
private transport rather than public component exports.

`tests/geojson-validation.test.mjs` exercises all six supported geometry kinds:
Point, MultiPoint, LineString, MultiLineString, Polygon and MultiPolygon. It covers
missing entries at each nesting depth, nonfinite/non-numeric/out-of-range axes,
wrong tuple lengths and open interior rings. Positive fixtures preserve dateline
coordinates, exact pole/longitude boundaries, holes and ring order through JSON
serialization without rewriting input. The before-fix regression run reproduced
23 sparse-array validation failures; the validator now checks both axes directly
and visits every geometry array entry.

These are host-side input/serialization checks. They do not establish MapLibre
projection at the poles, antimeridian rendering, hole topology, native malformed
transport rejection, or cross-platform visual/picking parity. Public shape input
has its separate ±85° latitude constraint. SRC-05/06 remains open for native and
broader geographic acceptance.

## Native GeoJSON preflight — 2026-10-27

Both hosts validate source framing and geometry before SDK conversion and before
removing the accepted scene. The native checks require a FeatureCollection with
at most 10,000 Features, unique nonempty string IDs of at most 512 UTF-16 code
units, object-or-null properties and one of the six supported geometry kinds.
Coordinates must be actual finite numbers in exactly two-axis arrays; numeric
strings and booleans are rejected. Ordinary source coordinates stay within
±180° longitude / ±90° latitude. Lines need two positions; polygon rings need
four, must close exactly and require an exterior ring. Empty multi-geometries
retain the host compiler's existing acceptance. A source has at most 50,000
positions, and both native scene paths enforce 50,000 positions across sources.
Errors remain recoverable `layer-scene` errors; a rejected source does not advance
accepted source revisions or replace working source/layer resources.

The 512-unit native feature-ID allowance preserves the private clustered-marker
transport, whose React key paths and Unicode IDs are broader than the internal
GeoJSON author's 128-character identifier grammar. Application marker metadata
still stays in JavaScript. This does not relax the authored source compiler.

Generated public shapes use the private `coordinateSpace: 'unwrapped'` source
field. `nativeShapes` emits it and `compileScene` preserves it; authored sources
cannot opt into it through their props. This mode accepts zero or one `geometry`
feature with null properties and LineString/Polygon geometry. It retains the
10,000-position shape limit, also counted across generated sources. Longitudes
remain finite and bounded to ±1,800,000°: the conservative envelope for at most
10,000 vertices unwrapped in nearest-world-copy steps from a canonical initial
coordinate. Latitude remains geographically bounded; public shape authoring
retains its stricter ±85° rule. Coordinates are neither wrapped nor rewritten.
Unknown coordinate-space values and generated-shape clustering reject. The mode
participates in source revision identity, and generated-source revision reuse
also checks it. Keep the JavaScript and native package code together when
rebuilding consumers.

A probe against the pinned Android GeoJSON SDK reproduced silent acceptance of
numeric-string axes, `[181,91]` and three-axis points; the native preflight rejects
those ordinary-source payloads. `tests/native-geojson-validation.test.mjs` runs
122 shared fixtures through the production Java and Foundation validators,
including boundary counts, malformed framing, ring closure, metadata/IDs and
15 generated-shape cases. Unicode ID fixtures cover distinct encodings and
UTF-16 length boundaries. Generated positive cases come from the real shape
compiler: dateline geodesic lines, circles, a polygon with aligned holes,
a multi-world route and an empty circle. Nonfinite native numbers are tested
separately. Java's test adapter consumes the same raw tree without a JSON-library
dependency; the Android app build/runtime checks exercise the JSONObject adapter.
The Foundation tests are explicitly skipped where Foundation is unavailable.

The Debug **Native scene validation** example deliberately bypasses the public
compiler. On iPhone 17 Pro / iOS 26.1 and EnhancedMapsVerification / Android 16
API 36 ARM64, both rebuilt native examples pass 13 checks: ten malformed updates
report their expected validator reason, accepted-scene fitting still returns the
original target, and real native feature taps retain the original source/feature
identity. A corrected update then renders/picks its replacement; a public
dateline Circle and geodesic Polyline render and pick their exact source IDs.
Tap coordinates come from native projection and measured layout. The run uses
no JavaScript debugger; the full iOS snapshot was collected only after the run
because unified logging truncated its JSON record. Scoped logs and screenshots
are saved locally under
`artifacts/verification/native-geojson/`. One earlier attempt expired waiting for
the operator's next tap; it is not counted as a pass. Metro was restarted when
unavailable, and Android used `localhost:8088` with adb reverse after its emulator
gateway failed to connect.

These checks do not establish polygon topology, rendering/picking of every
geographic corpus fixture, minimum-OS or physical-device behavior, frame/memory
budgets, or full native scene/style preflight. Deep property/parser complexity,
layer/style replacement failure handling and broader geographic acceptance remain
separate work. Bounds on the raw UTF-8 scene are still enforced before native
JSON parsing.
