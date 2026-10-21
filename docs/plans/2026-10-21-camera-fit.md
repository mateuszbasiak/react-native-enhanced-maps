# Camera fitting implementation plan

**Goal:** Fit explicit coordinates or accepted native map elements on both hosts.

**Architecture:** Reuse the bounded, correlated native query command for fit
acceptance, with style/unmount cancellation and a validated acknowledgement.
Native SDK camera fitting preserves heading/pitch and accounts for logical-point
edge padding. Promises acknowledge submission, not animation completion.

**Tech stack:** TypeScript, MapLibre Android Kotlin, MapLibre iOS Objective-C++.

1. Add failing fit request/result tests: coordinate bounds/count, padding,
   duration, acknowledgement and immutable serialization.
2. Add FitOptions and MapViewRef fitCoordinates/fitElements. Validate in JS and
   native code. Limit explicit inputs to 1000 coordinates and requests to 64KiB.
3. Native fitElements gathers mounted marker anchors and accepted GeoJSON geometry,
   excluding rejected candidate scenes. Empty elements reject. Shared per-host
   fitting uses the shortest longitude arc and the SDK's current heading/pitch.
4. Check native viewport/padding constraints before mutation; fit through the
   existing application provenance path and acknowledge acceptance.
5. Run checks/Codegen/builds and review. Add dev controls and verify padded fixture
   coordinates and accepted-element fitting on both running simulators.
6. Document evidence and remaining geographic/lifecycle matrices under CAM-09.

Verification extension: use a dev-only 160-point map-height toggle to exercise
native projection after a real Yoga resize and after expansion. This avoids
changing the iPhone example's supported orientations and avoids the observed
Android landscape input-coordinate problem in the automation backend. Reuse the
same coordinate fixtures and padding assertions; require the measured viewport
to change and retain the same native map readiness count. Also repeat fitting
after style reload and remount. These checks do not establish full lifecycle parity.

Existing uncommitted migration work remains in place; no commits or publishing.
