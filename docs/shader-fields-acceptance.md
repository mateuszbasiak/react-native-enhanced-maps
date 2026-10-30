# Named shader fields — bounded acceptance, 2026-10-30

The v1 authoring contract supports immutable typed-array inputs, named geographic
fields, an independently masked color scalar and explicit visual-only picking.
The existing single `data` grid, packed uniforms, simulation storage and legacy
WGSL helpers remain supported. See [the contract](shader-layer.md).

## Automated verification

Contracts cover typed input acceptance, immutable packing, invalid/sparse values
and masks, deterministic field-name slots, independent scalar validity, aggregate
sample bytes and equal maximum-grid acceptance through legacy/named inputs.
A GustKit 1.4-shaped fixture verifies row reversal, exact lattice bounds, dateline
normalization, polar cropping and independent missing scalar/vector samples.

The rendering-loop regression executes the actual worklet orchestration with
controlled GPU boundaries. It verifies frame-boundary field replacement, unchanged
simulation storage, new render/compute bind groups, disposal of old/final sample
and descriptor buffers, no repeated packet copies while output is unavailable,
and stopping an obsolete pipeline before it consumes a changed field-name schema.
Public declaration checks exercise typed arrays and the named-field types.

The final rebased `npm run check` passes 403 tests, types, lint/format, Codegen
and packed consumer declarations. Both production bundles pass.
Production bundle checks exclude Debug globals and configured local maps secrets.
Native compilation of WGSL and runtime observations below supplement the mocked
GPU boundary tests; they do not measure physical-device performance.

## Runtime setup and provenance

The source checkout was based on `c940525`, then rebased onto `cc93874` after
unrelated scene/overlay work merged. No native shader host, dependency manifest,
lockfile or build configuration changed in this feature. Existing compatible
Debug binaries from the dedicated `marker-callouts` validation checkout were
installed on a separate iPhone SE (2nd generation), iOS 26.1 simulator and Pixel
9a ARM64/API 36 emulator. These are reused binaries, not fresh native builds of
this feature branch. The application ID was `com.enhancedmapsexample.depthguard`.

An isolated Metro on port 8097 resolved this worktree's maps sources explicitly
while reusing existing dependencies. No dependencies were installed and no native
build outputs were generated in the feature worktree. Production bundles used
the same local resolver override; ordinary dependency installation does not need
that override.

Run `node scripts/shader-reference-server.mjs` for the deterministic style on
port 8107. Forward that port and Metro on Android. In the Debug example choose
**Shader field reference**, or select `shader-fields` through the scenario
session. The fixture uses a local opaque red sprite symbol at (0,0), four native
magenta marker frames, and green/blue GPU crosses. It compiles named-field helpers
in fragment and compute stages and obtains fields through the GustKit adapter.
The Debug `__enhancedMapsShaderFields` interface exposes bounded configuration,
snapshot, camera/projection controls and evidence reset. It is absent from
production bundles.

## Observed results

On iOS, ten settled reference scenes covered the base camera, a pan, 45-degree
heading/pitch, asymmetric padding, resolution scales 1/0.5/0.75, shorter viewport,
field replacement and below/above-label composition. Visible GPU cross centers
were 0–1.5812 physical pixels from native marker-frame centers. This is a
bounding-box center measurement of the synthetic references, not a bound for
all geographic coordinates or cameras. The deliberately label-occluded center
was excluded from alignment measurement in the below-label scene.

The field update changed green crosses to blue while the shader-ready count
remained 4. Scale/viewport changes recreated resources, as documented. Below-label
placement left three crosses visible with the center hidden by the sprite;
above-label placement restored all four. Native marker frames remained visible.

On Android, with explicit software-adapter diagnostic consent and resolution
scale 0.25, the settled above-label scene showed all four references with 0–1
physical pixel center differences. Below-label placement hid the center cross
and retained the other three, whose differences were 0.5–1 pixel. Initial
captures taken during Refresh/reinitialization were excluded. This is not the
full iOS camera matrix or hardware acceptance.

At half alpha, a green cross over the opaque red sprite produced RGB
`(127,128,0)` on both hosts; the iOS cross over white produced `(127,255,127)`.
This checks premultiplied-alpha composition for the synthetic fixture. Shader
pixels did not intercept ordinary map, tappable Circle or marker presses on
either host. The iOS shape/marker snapshot recorded `shape`, `marker-0`; Android
recorded `map`, `marker-0` and, in the clean rerun, `shape`. Map and shape checks
remove reference markers so marker hit ownership cannot mask the result.

An extended Android Debug session with many source refreshes, pipeline changes
and debugger connections ended in a native SIGSEGV on `mqt_v_js`, with top frames
in Hermes and React event dispatch. Its cause is unresolved; it is not recorded
as a passed lifecycle check. A clean-process rerun of the final fixture rendered,
passed shape touch-through and half-alpha composition with no reported errors.
Earlier successful settled observations remain bounded evidence, not proof that
the extended-session failure is fixed. Hiding the final shader leaves zero native
output pools on both hosts; this is not complete native allocation accounting.

Local screenshots, snapshots and the crash log are retained under ignored
`artifacts/verification/shader-fields/`; generated planning files remain local.

## Remaining acceptance

The broader GPU projection/composition/capability gates stay open: high zoom,
wrapping/polar/horizon behavior, animated/reprojected-frame alignment, orientation
and the full cross-platform camera/ordering/failure matrix need further evidence.
This change defines v1 picking as visual-only/touch-through; applications supply
ordinary selectable geometry and accessible controls. Shader pixels have no GPU
feature IDs or picking callbacks. Schema-generated authoring and streamed texture
inputs remain outside v1 scope.

Physical-device performance, energy, memory, accessibility and hardware-driver
validation remain maintainer-owned follow-up. Capability reports continue to mark
shaders unvalidated. No publishing approval or full shader release-gate completion
is implied.
