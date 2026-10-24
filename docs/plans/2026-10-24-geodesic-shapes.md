# Geodesic shape implementation plan

**Goal:** Add opt-in shortest great-circle edges to Polyline and Polygon,
including polygon holes, while preserving the component-only API and native scene.

**Architecture:** Shared JavaScript densifies validated immutable coordinates at
no more than 0.25 degrees of central angle per segment. Native MapLibre retains
projection, drawing and picking. Default/false geometry remains unchanged.
Generated points count toward the existing 10000-point shape budget. Cache paths
and polygon hole alignment by immutable input so style updates preserve sources.

Native-only tessellation would diverge between hosts; camera-dependent JavaScript
retessellation would add work during gestures. Shared bounded tessellation gives
both hosts identical geometry without a new native contract. It is an angular
approximation, not a screen-pixel error guarantee or an ellipsoidal geodesic.

**Boundary:** Input latitude remains ±85 degrees. Reject antipodal edges without
a unique shortest arc, any arc leaving the latitude range, and polygon rings
winding around a pole. Unwrap dateline paths and align hole world copies to the
outer ring. Circle already uses geographic radius and does not accept geodesic.
Per-vertex gradients and dash phase remain separate compatibility work.

**Steps:**

1. Add failing compiler tests for spherical midpoint/arc membership, unchanged
   default geometry, antimeridian continuity, polygon/hole closure and alignment,
   immutable reuse, boolean validation, degenerate/antipodal/polar edges and
   aggregate generated-point limits. Run the focused suite to observe failures.
2. Implement a private great-circle helper and wire the typed geodesic prop into
   Polyline/Polygon compilation. Keep native transport unchanged. Add public type
   acceptance/rejection cases and run contracts/typechecks.
3. Add an example comparison of straight and geodesic routes plus a geodesic
   polygon with a hole. Verify rendering and press behavior on both simulator
   hosts, using existing native binaries for this JavaScript-only change.
4. Document the approximation, limits and bounded results; update checklist.
   Run full CI and review the final diff. Publish an independent main-based PR.

**Commands:** npm run build; node --test tests/geodesic-shapes.test.mjs;
npm run typecheck; npm run ci. Expected: focused missing-prop tests fail before
implementation; all contracts, package checks and production bundles pass after.
