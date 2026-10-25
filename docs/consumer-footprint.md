# Core and shader consumer footprint

This is the JavaScript/npm-file portion of PERF-08. It provides repeatable
measurements without native app builds or simulator use. Native binary sizes and
clean/incremental native build costs remain separate checklist work.

## Reproduce

Run `npm run verify:optional-peers` (or append `-- --offline` with a populated
npm cache). The command prints its completed consumer matrix directory. Then run
`npm run measure:consumer-footprint -- MATRIX_DIRECTORY`. The reporter writes
`footprint.json` next to `verification.json` and prints the measured deltas.

The reporter requires all four consumers to have passed verification, checks the
maps tarball SHA-256, and requires `bundleFixtureVersion: 2`. Older fixtures used
MapView/Marker/Circle in core but only ShaderLayer in shaders; that difference
cannot establish incremental shader cost and is intentionally rejected.

The comparable core entry retains MapView, Marker and Circle. The shader entry
retains those same components and adds ShaderLayer, with the required Worklets
Babel plugin. Both are production Metro bundles for each platform. Successful
partial-peer bundles are not shader-runtime support and are excluded from the
supported bundle comparison.

## Measurement definitions

- **Maps package bytes:** the actual compressed npm tarball. Both entry points
  ship in one package, so core-only installation does not create a smaller maps
  tarball. Installing the optional peers changes the dependency payload.
- **Installed package payload:** sum of regular files inside installed packages,
  including manifests, native sources/assets and development tools. Scoped and
  nested dependencies are included, nested `node_modules` is counted separately
  rather than twice, and symlinks are excluded. This is logical file size, not
  allocated disk blocks or application storage. Core/both-peer totals use the
  generated manifests and their actual resolved lockfiles.
- **Production JS bytes:** exact bundle-file bytes and gzip level 9 bytes. The
  main comparison is a core consumer versus a both-peer consumer with the same
  core components plus ShaderLayer. Differences are specific to these fixture
  graphs, toolchain, plugin configuration and resolved dependencies. Gzip is a
  comparison metric, not a claim about the app store's compression format.

The report includes package names/versions/locations, per-package payloads,
consumer lockfile hashes, bundle hashes, source checkout commit, tool versions
and maps tarball hash. Additional package identities are listed so dependency
changes can be distinguished from common tooling. The tarball and lockfile
hashes identify the measured artifacts; a checkout commit alone does not capture
uncommitted source changes or future registry resolution.

## What this does not measure

These numbers are not Hermes bytecode, APK/AAB/IPA size, native linked-code size,
platform slicing, download size, runtime memory, GPU allocations, frame time,
energy or build duration. Native peers include files for more than one platform;
their installed npm payload must not be presented as per-device binary overhead.
No numeric release budget is accepted by this report. Physical-device acceptance
remains maintainer-owned follow-up.

## Measured baseline — 2026-10-25

The version-2 matrix completed on source checkout `5f7140cc8f5f15818c7348d8608343ea2f46cc32` with
Node v22.17.1 / npm 11.5.2, React 19.2.3, React Native 0.85.3,
WebGPU 0.17.0 and Worklets 0.12.2. The maps tarball was 172,536
bytes with SHA-256 `ff98202eb676e2fa152009cb083b8312dd911d887f87fd4ef548bde668f1d113`.

Installed regular-file payload (including the same development-tool baseline):

- Core: 188,947,512 bytes across 479 package instances.
- WebGPU only: 481,980,283 bytes.
- Worklets only: 190,169,522 bytes.
- Both peers: 483,202,293 bytes across 487 package instances.

The both-peer delta was 294,254,781 bytes
(280.62 MiB). Most of that was
`react-native-webgpu-dawn`: 291,752,175 regular-file bytes. This measures its
installed multi-platform package payload, not linked GPU code in one application.

Comparable production bundle measurements:

- ios: core 1,029,419 raw / 262,906 gzip-9 bytes; core plus shaders 1,159,688 raw / 291,029 gzip-9 bytes. Delta: **130,269 raw / 28,123 gzip-9 bytes**.
- android: core 1,033,945 raw / 263,799 gzip-9 bytes; core plus shaders 1,164,215 raw / 291,918 gzip-9 bytes. Delta: **130,270 raw / 28,119 gzip-9 bytes**.

The core-only bundles were byte-identical with neither peer and with both peers
installed, on each platform. Adding ShaderLayer increased these minimal fixture
bundles by about 127.2 KiB raw and 27.5 KiB gzip-9. This is a useful baseline for
optional-entry isolation, not a universal application-size budget.

All four isolated installations/declaration checks and 16 bundle checks passed.
Reporter aggregation tests and the full package checks passed (235 tests).
Review caught and corrected the initial mismatched-entry comparison before these
results were recorded. Native binary sizes and build timings remain unmeasured.
