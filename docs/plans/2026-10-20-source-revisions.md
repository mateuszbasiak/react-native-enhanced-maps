# Native source revision enforcement

**Goal:** Carry explicit GeoJSON source revisions to both MapLibre hosts and prevent stale replacements from changing the accepted scene.

**Architecture:** Keep optional revisions optional. Unversioned sources and generated shapes retain replacement behavior. Explicit revisions are nonnegative safe integers; a lower revision, changed serialized data at an equal revision, or removal of a revision from a still-present versioned source rejects the entire incoming scene before SDK mutations. Equal revision/data permits layer/style changes. A higher revision permits replacement.

Native validation is preferred to JS-only validation because the native host owns accepted resources and asynchronous style loading. Automatically assigning revisions to every render would change the optional API and would not identify stale producer data.

Revision state belongs to a source's current presence in a map. Successfully removing it resets its lifetime; re-adding may start at zero. Style reload preserves accepted state and replays the last accepted scene if current props were rejected. Disposal closes the Android gate; iOS state is owned by the non-recycled view and destroyed with it. Style-load callbacks must verify current style/request identity. This does not add asynchronous source jobs or guarantee transactional rollback for arbitrary SDK exceptions.

**Tech stack:** TypeScript scene compiler, Java gate and Kotlin host, C++ gate and Objective-C++ host, Node contract runner and standalone native tests.

## Implementation plan

1. Add a failing scene-compiler regression proving explicit revisions survive JSON transport while omitted revisions/shapes stay unversioned. Implement transport and document the optional API.
2. Add executable Java/C++ gate regressions: initial/equal/newer/stale revisions, equal-revision data conflict, optional revisions, independent sources/maps, removal/re-addition, rejected batches, safe-integer bounds and disposal. Run red, then implement equivalent native gates with validate-before-commit semantics.
3. Integrate gates before native scene resource removal; commit revision state only after successful application. Preserve accepted scene/state across style replacement. Guard stale style callbacks and disposal. Verify integration with native builds and existing checks.
4. Update package docs, verification log and SRC-03 with the actual evidence. Run `npm run check`, production bundles and available native builds. Do not interact with devices/simulators.

The user approved SRC-03 implementation in this chat. Work stays in the current checkout to preserve the existing uncommitted migration; no unrelated changes are staged or committed.
