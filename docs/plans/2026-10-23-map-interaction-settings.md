# Map interaction settings implementation plan

**Goal:** Add native gesture toggles, compass visibility and portable zoom limits.

**Architecture:** Validate settings at the MapView boundary, forward typed Fabric
props, and apply the whole native transaction before initial camera setup or when
props change. Use package zoom defaults [0,24], reject invalid intervals, and widen
SDK constraints before replacing disjoint intervals. Keep attribution intact and
camera commands independent of gesture enablement. Persistent padding is a
separate geometry change.

**Tech stack:** TypeScript, React Native Fabric/Codegen, MapLibre Kotlin and iOS.

1. Add failing normalization tests for defaults, false values and invalid ranges.
2. Implement `packages/maps/src/mapSettings.ts`, public types, MapView forwarding
   and `specs/MapLibreViewNativeComponent.ts` fields. Run the focused tests.
3. Apply settings in `EnhancedMapLibreView.kt`, its manager and `EMMapLibreView.mm`.
   Native updates must validate before changing state and avoid repeated setters.
4. Add public type coverage and a Debug-only `MapSettingsVerification.tsx` scenario.
5. Run package/quality checks, Codegen, bundles and both native Debug builds. Test
   toggles and zoom clamping on both simulators; record bounded results.
6. Review the change, fix findings and publish an independent main-targeted PR.
