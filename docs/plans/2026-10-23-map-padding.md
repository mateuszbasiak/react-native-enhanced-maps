# Persistent map padding implementation plan

**Goal:** Add persistent logical-point mapPadding, composed once with per-fit margins.

**Architecture:** Normalize bounded edges into Fabric scalars; apply content insets
on iOS and camera/projection padding on Android. Preserve the geographic camera
center when padding changes. Reapply after layout. If requested insets consume a
nonempty viewport, report a recoverable error once per request/size and use zero
effective padding until the viewport fits; empty layouts defer application.
Fit validation and projected-corner checks use the combined effective viewport.
Attribution remains visible and the SDK owns ornament placement.

**Tech stack:** TypeScript, Fabric/Codegen, MapLibre Native Kotlin and iOS.

1. Add failing normalizer tests for copied fractional edges and malformed inputs.
2. Add MapPadding types, scalar props and native setters. Validate at JS/native
   boundaries, apply settings on prop/layout changes, and avoid repeated updates.
3. Include effective map padding once in native fit viewport checks; preserve
   rollback and command-origin semantics. Document per-fit versus persistent edges.
4. Extend the Debug settings fixture with padding, projection and fit probes.
5. Run package checks, bundles and both native Debug builds. Verify center anchoring,
   asymmetric fit containment, reset, invalid-size recovery and resize behavior.
6. Review, resolve findings and publish with gh stack above the settings PR.
