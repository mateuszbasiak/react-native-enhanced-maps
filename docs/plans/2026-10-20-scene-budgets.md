# Scene-wide source budgets

**Goal:** Prevent independently valid GeoJSON sources from combining into an unbounded native scene.

**Design:** Retain the current resource-count limits and add combined limits: 50,000 declared positions, 100,000 positions weighted by referencing layers, and 4 MiB of UTF-8 scene JSON including properties and layer definitions. Count generated shapes as well as user sources. Cache position counts by immutable data identity. Count serialized UTF-8 bytes without requiring TextEncoder/Buffer in React Native; reject before returning native props. Native hosts independently reject oversized UTF-8 scene payloads before JSON parsing or resource mutation.

This extends existing per-source safeguards rather than silently truncating input. It does not move parsing off the UI thread or establish performance budgets. JS/native malformed and stale-update handling beyond these existing contracts remains separate work.

## Plan

1. Reproduce missing aggregate declared/rendered-position and Unicode byte limits with compiler regressions, plus accepted bounds and all GeoJSON geometry kinds.
2. Implement immutable source position-count caching and UTF-8 byte-budget serialization in an internal scene-budget module; wire it into compileScene.
3. Add native UTF-8 payload-size checks before parsing on Android/iOS. Verify with SDK builds.
4. Update contracts/checklist/evidence and run workspace checks and bundles. No device interaction.
