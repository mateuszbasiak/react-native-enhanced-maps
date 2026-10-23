# Native map geometry queries

**Goal:** Implement CAM-09's coordinate-to-screen, screen-to-coordinate and
visible-bounds queries using the actual native SDK projection.

**Design:** Add async pointForCoordinate, coordinateForPoint and getVisibleBounds
to MapViewRef. A shared request broker bounds pending queries to 32, correlates
positive per-map IDs, and times out after 5 seconds. Native UI-thread commands
return one small JSON result/error with the ready style revision. Style changes,
fatal readiness errors and unmount reject pending promises; late responses are
ignored. Validate arguments before native dispatch and finite result geometry
before resolving. Screen positions use map-relative logical points. Bounds and
inverse longitudes retain SDK wrapping semantics rather than inventing camera math.

Alternatives: JS Mercator calculations fail under rotation/pitch/insets; unbounded
promise maps leak on native failure. A synchronous JSI dependency is unnecessary
for user-driven queries. Fit methods remain the next CAM-09 implementation step,
not a reason to mark the whole item complete now.

**Steps:**

1. Add failing broker correlation, cancellation, timeout, bounds and validation tests.
2. Implement typed public methods, request/result bridge and both SDK adapters.
3. Add bounded development round-trip/bounds controls and evidence.
4. Run checks, Codegen, native builds and bundles; install and verify round trips
   at ordinary and rotated/tilted cameras on both simulators.
5. Review, document and update CAM-09 with the remaining fit-method scope explicit.
