# Structured feature hit results

**Goal:** Complete PICK-01's missing public layer/properties hit information while preserving source `onPress(featureId)` and shape callbacks.

**Design:** Add `GeoJSONSource.onFeaturePress` with source ID, layer ID, feature ID,
SDK-returned JSON properties, geographic coordinate and map-relative logical-point
position. The native topmost interactive rendered-layer query remains authoritative.
Transport properties from the hit itself, rather than looking them up in current
React props (which may differ from an accepted native scene after a rejected update).
Bound event properties to the existing 4 MiB scene ceiling and validate JSON
objects/depth/finite values in JS. Bind native hit events to the ready style revision
so queued hits from an older style are ignored. Both callbacks can coexist.

Alternatives: replacing `onPress` would break callers; JS feature lookup would return
incorrect properties after native scene rejection. A new standalone query API is
separate work for overlapping result lists and radius queries.

**Plan:**

1. Write failing parser and scene-interactivity/callback tests.
2. Add public types, parser, compiler callback routing and Codegen event fields.
3. Emit actual SDK properties/layer IDs and ready revision on both native hosts.
4. Extend bounded development evidence with a tappable known-property feature.
5. Run checks, Codegen, bundles, both native builds; install and verify actual hits
   on both running simulators, including rejected-source/style-reload cases.
6. Review changes and update checklist/evidence without closing broader PICK work.

The user's standing instruction authorizes autonomous checklist implementation;
preserve existing uncommitted work and do not publish.
