# Cluster maximum-zoom and overlap acceptance

Checked on 2026-10-27.

Both iPhone 17 Pro / iOS 26.1 and Android 16 / API 36 ARM64 passed the following
bounded checks using the existing Debug `clusters` fixture. Source and native
build provenance is commit `023a5f84c8e3d9a1e31835f6300d663d24f8b9ff` (the
callout branch, including the cluster participation lifetime fix). The clustering
SDK implementation and fixture are unchanged by the callout feature. These
observations do not require a new public API or a dependency on that feature.

Configure six coincident markers with custom cluster children and grouping
enabled. The `moving` group contains vessel-1/3/5 and `moored` contains
vessel-0/2/4. Drive zoom through 14, 14.5, 15 and back to 14 using the fixture's
`animate` method. At each step, wait for the matching native camera-idle zoom and
three consecutive matching cluster observations; then query each available
group's members through its custom component handle.

- Zoom 14 and 14.5: exactly two clusters, each with count three, and exact group
  memberships on both hosts.
- Zoom 15: no custom cluster children; the native accessibility trees expose all
  six individual vessel marker hosts at the shared coordinate on both platforms.
- Return to zoom 14: both clusters and the same exact memberships return, with
  no fixture errors.
- At zoom 14, a native tap at the discovered `Inspect 3 markers` button in the
  overlapping custom children returns vessel-1/3/5 on both hosts. This verifies
  the upper `moving` group's input/member routing in this concrete overlap case.

The camera evidence uses the API zoom, not the native accessibility summary's
rounded zoom label. Receipt collection ran against verified device-specific
debugger connections and the worktree's Metro project. Local ignored receipts
include camera events, cluster counts/coordinates, full member IDs, native
accessibility trees at zoom 15 and the native-tap membership result.

Android layout publication lagged a camera-idle observation during the transition;
the checks waited for layout convergence rather than treating camera idle as a
cluster-layout completion promise. These results assert eventual functional
behavior, not frame alignment or a latency bound. Arbitrary spatial membership,
antimeridian behavior, general overlap ordering, in-flight source cancellation
and visible-output/memory bounds remain open. Physical-device performance and
full screen-reader acceptance remain maintainer follow-up.
