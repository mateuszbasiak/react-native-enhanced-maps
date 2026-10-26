# Optional GPU peer consumer verification

`npm run verify:optional-peers` packs the built maps package and verifies four
independent consumers under the system temporary directory, outside the
workspace. It does not modify existing consumers or require a simulator.

The supported combinations are checked separately:

- Neither optional peer: core installation, declarations and bundles work;
  shader bundle outcomes record the absent runtime peers.
- `react-native-webgpu` only: core installation, declarations and bundles work;
  shader bundle outcomes record the missing Worklets runtime.
- `react-native-worklets` only: core installation, declarations and bundles work;
  shader bundle outcomes record the missing WebGPU runtime.
- Both peers: core and shader declarations and production bundles work on iOS
  and Android. This does not establish native linkage or shader initialization.

The matrix pins React, React Native, optional peers and consumer development
tools from the example/lockfile baseline. Each consumer uses normal npm peer
resolution with install scripts disabled; it does not use `--legacy-peer-deps`
or `--force`. The documented Reanimated 4.6.0 resolver override from
[native consumers](native-consumers.md#optional-peer-resolver-constraint) is
explicitly included. Broader peer versions are outside this check.

## What the verifier asserts

The installed maps package must be unpacked inside each consumer, not linked to a
workspace. Optional peer presence and versions must match the selected
combination, and `npm ls --all` must accept the dependency tree. TypeScript checks
both public entry points using the consumer's own installed toolchain. Public
shader prop declarations can compile without the runtime peers; that alone does
not make the shader entry usable.

Each consumer bundles a minimal core entry for iOS and Android with a Metro
resolver that records and rejects any WebGPU/Worklets import. A persistent
sentinel must remain absent after each core bundle, because Metro can swallow
resolver exceptions for optional imports. A negative-control fixture deliberately
requires WebGPU inside `try` and must create the sentinel before it is cleared.
Thus the core check detects attempted imports even when bundling itself succeeds,
including when optional peers are installed. A separate shader entry retains the same MapView/Marker/Circle imports and adds
ShaderLayer, using the Worklets Babel plugin when both peers are present. Matrix
reports label this comparable entry pair as `bundleFixtureVersion: 2`. When a peer is
omitted, bundle success is recorded separately as `bundled-with-missing-runtime-peers`,
not shader runtime support. React Native Metro permits optional dependencies in
`try` blocks, so a missing runtime can defer failure until initialization. A
bundle failure counts as expected only if Metro names an exact omitted package
as the unresolved module; plugin, syntax, missing subpath or unrelated setup
failures do not count. Successful production bundles pass the existing
reserved-development-global exclusion check.

The command prints the generated directory and writes per-command logs,
consumer manifests/lockfiles, bundles and `verification.json` there. The report
records the source checkout commit, packed package SHA-256, Node/npm versions,
resolver override and per-case declaration/bundle outcomes. The tarball hash is
the package-content identity; a checkout commit alone does not describe local
uncommitted edits. Do not commit generated consumers or logs.

Use `npm run verify:optional-peers -- --offline` only when registry metadata and
all required package tarballs are already cached. A cache miss is a failed
verification attempt, not a package compatibility failure or a pass.

## Acceptance limits

This matrix is the installation/declaration/JavaScript bundling slice of REL-05.
It does not build a native consumer, install or start an app, exercise shader
capabilities/error callbacks, measure GPU performance, or close Release privacy
acceptance. Native GPU consumer Debug/Release builds and runtime verification
remain separate work. Physical-device validation is maintainer-owned follow-up.

## Bounded results — 2026-10-25

The final `npm run verify:optional-peers -- --offline` completed all four
consumers with Node 22.17.1 / npm 11.5.2, React 19.2.3 / React Native 0.85.3,
WebGPU 0.17.0 and Worklets 0.12.2. The package checkout baseline was
`02dcfb7145020519addac138c94ecaaebd732eec`; the packed tarball SHA-256 was
`6dc88e5309b7d30d89a7bd9bbb4d8592d98404623a4d01a8d5cd2cbbf958b13a`.

All four normal-npm installations, dependency trees and core/shader declaration
checks passed. All eight core bundles passed without GPU import attempts. The
negative-control optional import created the guard sentinel as required.

For shader entries on both platforms, neither-peer and Worklets-only consumers
rejected the missing WebGPU package. WebGPU-only consumers bundled successfully
without Worklets and are recorded as `bundled-with-missing-runtime-peers`.
Both-peer consumers bundled successfully with the Worklets Babel plugin enabled.
These are 16 bundle checks: 12 successful bundles and four expected missing-peer
rejections. No partial-peer result is counted as shader runtime support.

The first offline attempt failed on uncached CLI metadata. Registry-backed runs
populated the cache and exposed the optional-dependency bundling distinction;
the final offline run included the stronger persistent guard and probe. Failed
attempts are not counted as passes. Repository `npm run check` also passed 128
tests, types, lint/format, Codegen and packed declaration checks. No native app
build, simulator or physical device was used for this matrix.
