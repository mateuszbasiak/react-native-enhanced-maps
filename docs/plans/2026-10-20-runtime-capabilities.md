# Runtime map capabilities

**Goal:** Expose the current native map host's capabilities after readiness, without treating SDK availability as production validation.

**Design:** Each native host attaches a bounded capability JSON report to its readiness event. Reports identify engine/platform and enumerate existing typed layer kinds, detailed gestures and integrated shaders. Implemented circle/line/fill paths are unvalidated while their runtime quality gates remain open; absent symbol/raster/heatmap, detailed gestures and live shaders are unsupported. This reports integrated native map support regardless of whether the optional TypeGPU helper is installed.

MapView validates/freezes the report, caches it for `ref.getCapabilities()` and delivers optional `onCapabilitiesChange`. Readiness callbacks run after caching; an unready/disposed map returns null. Style replacement/fatal errors invalidate the cached report. A malformed report emits a fatal invalid-native-capabilities error, rather than silently guessing from Platform.OS. No new native command/TurboModule or JS dependency detection is needed.

A JS-only provider lookup would not prove which native host was loaded. A TurboModule query would add another native module for view-specific readiness state. The readiness event uses the existing Fabric boundary.

## Implementation plan

1. Add failing report-parser tests for required engine/platform/enums, missing/unknown fields, malformed JSON, cross-platform mismatch, bounds and immutable output. Implement a pure parser.
2. Extend public ref/props and positive/negative type tests. Extend readiness Codegen event with report JSON; wire cache, callback and invalidation into MapView.
3. Add report constants to both native readiness events; regenerate example Pods/Codegen headers and build both platforms.
4. Update feature contract/checklist and evidence. Run full workspace checks, bundles and native builds. No device interaction.

Review correction: bind readiness reports to a per-map style-request revision and ignore old/detached reports. Native iOS emitter readiness uses the loaded revision snapshot. The pinned MapLibre core `src/mln/style/style_impl.cpp::loadURL` creates a request even when URL strings match, so same-URL request revision changes can reload through the normal setter.
