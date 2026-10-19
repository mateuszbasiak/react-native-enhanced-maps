# v1 risk register

All items begin unvalidated. Update this register with artifact paths and measured results rather than assumptions.

## R1 — GPU projection and composition (critical)

Risk: a separate GPU surface drifts during provider camera motion, cannot reproduce projection, or cannot compose as required.

Evidence: three-provider anchor alignment recordings covering zoom, tilt, rotation, padding, resize, wrapping, high latitudes, and interrupted animations. Measure error in physical pixels with documented tolerances. Record attribution/control placement and unsupported depth/label ordering.

Decision: choose overlay architecture only if it passes the defined contract. Otherwise investigate alternatives and report blocked requirements before freezing APIs.

## R2 — Frame scheduling and JS contention (critical)

Risk: TypeGPU rendering depends on application JS scheduling, producing visibly stale overlays.

Evidence: compare idle JS with a reproducible busy-JS workload; capture timestamps for provider camera, GPU submission, and presentation where available. Distinguish source/GPU computation speed from scheduling latency.

Decision: assess direct native synchronization or a minimal additional runtime only when evidence requires it. Record dependency, binary-size, and lifecycle costs.

## R3 — Resource lifetime (critical)

Risk: late async jobs, GPU resources, or SDK delegates survive disposal and cause crashes/leaks.

Evidence: automated mount/unmount, multiple map, background/resume, source replacement, initialization failure, and device-loss recovery tests with counters and native memory traces.

Decision: generation guards, cancellation, bounded work queues, explicit ownership, and idempotent teardown are required before alpha.

## R4 — Layer semantics differ by provider (high)

Risk: symbol collision, heatmaps, expressions, picking, or ordering differ or exceed SDK primitives.

Evidence: capability inventory and identical fixtures on three backends, including unsupported cases.

Decision: implement a tested common contract plus explicit extensions. Do not silently accept unsupported style properties. Choose native primitives versus custom renderer per layer after profiling.

## R5 — Gesture coexistence and camera feedback (high)

Risk: gesture observers interfere with SDK interaction or controlled camera updates interrupt users.

Evidence: multi-touch, cancellations, nested scroll/bottom-sheet, animation interruption, and origin traces. Test SDK controls separately from gestures.

Decision: public SDK APIs only; explicit unknown provenance where detection is ambiguous; documented camera precedence.

## R6 — Dataset scale and clustering consistency (high)

Risk: indexing or updates block UI; cluster identity flickers; renderer object counts explode.

Evidence: deterministic uniform and dense datasets at 1k/10k/100k inputs, replacements and small updates; memory, processing latency, membership, and displayed object counts. These are test workloads, not promised capacities.

Decision: bound rendered output and caches, cancel obsolete work, select algorithm from measured results.

## R7 — Dependencies and installation (high)

Risk: optional shader/Google features accidentally become mandatory; native dependency constraints conflict.

Evidence: clean packed-tarball consumers for core-only, Apple-only, Google, and TypeGPU paths; inspect native artifacts and application size differences.

Decision: separate GPU companion, optional Google iOS installation, tested peer ranges, no unmeasured framework additions.

## R8 — Compatibility and maintenance (high)

Risk: familiar API implies unsupported drop-in compatibility or SDK updates break behavior.

Evidence: a pinned react-native-maps API inventory with supported/partial/deferred entries and contract tests, plus an explicit RN/OS/SDK support matrix.

Decision: conservative compatibility claims and documented upgrade policy. Verify license obligations when reusing code.

## R9 — Verification blind spots (high)

Risk: mock tests, simulator screenshots, or uncontrolled basemap changes produce false confidence.

Evidence: structured native state, physical release-build traces, reproducible seeds, preserved artifacts, and explicit skip reasons.

Decision: ordinary CI covers builds/types/contracts; device runs gate SDK integration and release performance. Missing credentials or hardware is a recorded blocker, never a pass.

## R10 — Accessibility and sensitive diagnostics (high)

Risk: GPU features are inaccessible or debug artifacts expose credentials/location.

Evidence: screen-reader/reduced-motion scenarios, release-build diagnostics exclusion, and redacted sample reports.

Decision: accessibility equivalents for interactive GPU features; development-only instrumentation with explicit opt-in for sensitive data.
