# Marker comparison prototype

**Goal:** Compare Android bitmap markers, advanced iconView markers, and native-positioned React Native overlays before selecting a public API.
**Architecture:** Experimental Android-only component reuses the map host with real RN children. Native host owns coordinate projection and rendering; JavaScript creates deterministic content only. Mode changes remount the map. Include an empty-map baseline. No clustering or culling initially: counts describe mounted/rendered workload, not promised capacity.
**Tech stack:** React Native Fabric, Kotlin, Google Maps SDK 20.

## Implementation plan

1. Add deterministic coordinate generator and frame-summary tests; verify failure, implement, verify pass.
2. Add experimental native props, marker child management, renderer cleanup and native frame sampling.
3. Add independent example screen with counts 100/500/1000/5000, identical Pressable children and repeatable camera path.
4. Run TypeScript, codegen, contract checks and Android build. Inspect device availability and run comparison if possible.
5. Document reproducible release measurements, limits and actual evidence. Never treat callback frame timing as GPU presentation timing or native marker clicks as nested RN presses.

## Acceptance

Same coordinates/content/camera for all modes. Map-only baseline. Nested press count distinct from native marker click count. Record mount readiness separately from rendering completion. Native frame interval samples measured during a fixed camera workload; memory captured externally. Advanced mode must report unsupported capability rather than silently fall back. Public Marker API deferred.
