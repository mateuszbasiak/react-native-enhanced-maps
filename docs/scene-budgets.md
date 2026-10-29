# Scene input budgets

The package rejects oversized scenes rather than truncating data. `compileScene`
checks the whole scene, including GeoJSON sources and generated Polyline/Polygon/
Circle sources, before returning native props. The serialized scene must fit in
4 MiB of UTF-8 JSON, including feature properties and layer definitions. Android
and iOS independently enforce this before native JSON parsing or replacement.
Rejections are recoverable `layer-scene` errors.

There are no fixed scene source/layer counts or declared/rendered position-count
caps, and no separate 64-shape/10,000-position collection cap. Geometry validation,
property complexity bounds and component-specific limits (for example image
composition and Geojson compatibility expansion) still apply. Circle and geodesic
vertices contribute their serialized bytes. Geodesic expansion checks this byte
budget incrementally before retaining oversized intermediate output.

Ordinary shape components share native sources and data-driven paint layers. At
equal zIndex, fills draw below outlines; layout/dash/gradient incompatibilities
split ordered stroke runs. Different zIndex values and other intervening content
preserve their ordering boundaries. See [the shape contract](shapes.md).

Data is immutable: replace arrays/objects when geometry changes and increase an
explicit authored source revision. These checks bound transport, not frame time
or total memory. Native hosts still rebuild scene resources, and Android inline
tiling runs synchronously. Batching reduces resource counts; incremental updates,
worker indexing and release-device performance budgets remain separate work.

Generated geometry keeps finite latitude/longitude validation. Its conservative
unwrapped-longitude envelope is now derived from the 4 MiB scene bound: a position
needs at least six JSON bytes and a nearest-world-copy step spans at most 180°.
The former envelope based on 10,000 positions no longer rejects longer routes.
Ordinary authored GeoJSON still requires canonical ±180° longitude / ±90° latitude.

The dated records below describe verification at the time they were written;
the count-cap assertions in those historical runs have been superseded by the
current contract above.

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
unique nonempty string IDs of at most 512 UTF-16 code
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

## Native scene graph and style preflight — 2026-10-27

Both hosts validate the private scene graph and supported literal styles before
removing accepted resources. The checks cover the 64-source/128-layer limits,
object framing, unique resource IDs, source references, insertion targets,
booleans, clustered-source filters and collisions with existing basemap or shader
resources. Source names retain the 128-character SDK grammar; generated stroke
layer names can include the seven-character prefix. Feature IDs follow their
separate source/marker contract.

Style values are checked without numeric-string or boolean coercion. Each layer
type has an explicit property set with finite bounded numbers, canonical hex
colors, line enums, bounded dash arrays and strictly ordered gradient stops.
Colors require a complete match, including rejecting trailing newlines in iOS
scalar and gradient colors. The SDK source, gradient and layer objects are also
constructed before accepted resources are removed. Preflight rejections do not
advance accepted source revisions or cluster indexes.

This preflight protects malformed input in the currently supported circle, line
and fill transport. It does not expose general style-spec expressions or close
the remaining component-surface requirements. It does not promise recovery from
unexpected SDK allocation failures or asynchronous resource failures; deep parser
complexity, geographic render/pick matrices and measured frame/memory costs
remain separate acceptance work. Physical-device validation is maintainer-owned.

The shared Java/Foundation corpus has 56 graph/style cases, including actual
compiler output for a dateline circle, a geodesic gradient and a polygon whose
128-character ID produces a 135-character stroke-layer ID. It covers malformed
scalars, style enums/numbers/colors/dashes/gradients, resource counts, references,
external collisions and valid insertion targets. Full local checks pass 291 tests.
Both native Debug builds and production JS bundle checks pass.

On iOS 26.1/iPhone 17 Pro and Android 16/API 36 ARM64, a 22-case raw-scene run
rejected 19 malformed graph/style/geometry updates while preserving native fitting
and exact feature/source hits, then accepted a repaired scene and dateline circle
and geodesic replacements. After gradient-stop hardening, a focused two-case run
on the final builds rejected the newline-color gradient while retaining the old
fit/hit, then rendered and picked a valid dateline gradient. These runs use native
taps at projected/measured coordinates; a debugger reads bounded Debug fixture
snapshots. Two driver-interrupted attempts exceeded the operator tap deadline
and are excluded. Local results are in
`artifacts/verification/native-scene-preflight/`.
