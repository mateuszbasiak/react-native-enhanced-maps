# Native camera provenance

**Goal:** Populate the existing CameraEvent.origin from native SDK movement reasons.

**Design:** Android records each SDK camera-move-start reason (gesture, developer animation, API/SDK movement) and consumes it at idle, resetting to unknown to avoid labeling unrelated later idle events. iOS uses the public regionDidChangeWithReason callback and reason flags: any native gesture bit wins, compass reset is SDK, programmatic is application, no known reason is unknown. Mixed reasons describe native evidence, not exclusive ownership or detailed gesture lifecycle. JS normalizes unknown/future origin values to unknown.

This uses native SDK provenance rather than camera-delta guesses or a JS command flag that can survive an interruption. No live camera subscriptions or detailed gesture lifecycle API are introduced.

## Plan

1. Add failing Java/C++ tests for origin priority, interrupted movement, consuming idle, unknown defaults and independent maps. Add JS normalization regressions.
2. Add view-owned Android tracker and native flag classifier, iOS reason callback and shared native classifier, and an origin field to the existing idle Codegen event. Wire JS normalization.
3. Regenerate Codegen/Pods, run workspace checks, bundles and both native SDK builds. Update camera contract/checklist and evidence. Runtime timing/gesture scenarios remain unverified; no device interaction.
