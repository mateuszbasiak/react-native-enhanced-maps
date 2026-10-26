# Remote package CI acceptance — 2026-10-25

TEST-03/TEST-10 remote workflow verification is complete for the revisions below.
This is dated evidence from actual GitHub Actions jobs, logs and downloaded
artifacts, not a claim based on workflow configuration alone. Later revisions
need their own successful runs.

## Verified revisions

- **Main:** [run 40209978955](https://github.com/mateuszbasiak/react-native-maplibre-maps/actions/runs/40209978955),
  push event, checked-out commit `02dcfb7145020519addac138c94ecaaebd732eec`.
  All three jobs completed successfully on 2026-10-25.
- **Compatibility PR #46:** [run 40212771259](https://github.com/mateuszbasiak/react-native-maplibre-maps/actions/runs/40212771259),
  pull-request event, head `fc24b072bfa44d5ac7531d6f96f3ab8a75d3789a`.
  Checkout logs confirm GitHub merge commit
  `a58ae79bfc0e5aa16717aa23349557c093e06dbe`, merging that head into the main
  commit above. All three jobs completed successfully on 2026-10-25. This
  records PR integration evidence, not a merged-main result for PR #46.

The workflow is [Package checks](../.github/workflows/check.yml), using Ubuntu
24.04 and Node 22.17.1. The contracts job sets up Temurin Java 17 and verifies the
host C++ compiler (GCC 13.3.0 in the inspected main run). Every job installs locked
dependencies with `npm ci --ignore-scripts --no-audit --no-fund`.

## Observed checks and outputs

For each run, the job API and step logs confirm:

- **Lint and Prettier:** both checks pass.
- **Types, contracts, Codegen and packages:** package declaration build, package
  and example TypeScript checks, 128 tests with 128 passes, zero failures,
  cancellations or skips, Android/iOS Codegen, package packing and isolated
  packed-consumer declaration resolution pass. The PR #46 revision additionally
  compiles the RN Maps migration fixture against source and packed declarations.
- **Production JavaScript bundles:** Metro writes both iOS and Android output
  bundles successfully. This is JavaScript bundling, not native app compilation.

The artifact API reports non-expired `package-verification` and
`production-bundles` artifacts for both runs at inspection time. Both were
downloaded and inspected. Each contains the expected package/check log or
platform bundles/bundle log. The package tarball includes `lib/index.d.ts`.

The following outputs have identical sizes and SHA-256 hashes across the two
runs:

- `react-native-maplibre-maps-0.0.0.tgz`: 168,744 bytes;
  SHA-256 `6dc88e5309b7d30d89a7bd9bbb4d8592d98404623a4d01a8d5cd2cbbf958b13a`.
- iOS `main.jsbundle`: 1,213,695 bytes;
  SHA-256 `6e6e790bf4c72630b10ca86ceadba2a45bbe19b6b409c0c0e0c153d4d6acd476`.
- Android `main.jsbundle`: 1,215,426 bytes;
  SHA-256 `f211d74e16b01d092c30cf1a0d3e38298f8409a1866d3a812377261269283bac`.

Matching these particular outputs does not establish general reproducible builds
or native binary size. The workflow retains artifacts for seven days; hashes
and run/commit identifiers remain useful provenance after artifact expiration.
No generated bundles, tarballs or downloaded logs are committed with this record.

## Scope and remaining acceptance

Native CI app builds were intentionally removed in PR #13. The Java/C++ helper
tests above run on the host; Codegen and production bundles do not establish an
iOS/Android app build, runtime rendering, shader leak resolution, Release
privacy, physical-device behavior or performance. Native build and runtime
evidence remains in [native consumers](native-consumers.md),
[scenario sessions](scenario-sessions.md) and the relevant feature records.
Physical-device validation is maintainer-owned follow-up.

## Refreshing the evidence

Use `gh run list --workflow check.yml --branch main` to select a run for the
intended revision. Inspect `gh run view RUN_ID --json headSha,conclusion,jobs,url`
and `gh run view RUN_ID --log`, including the checkout commit, actual check
steps and test counts. For PRs, distinguish the PR head from the checked-out merge
commit. Confirm both artifacts using the Actions artifacts API and download with
`gh run download RUN_ID --dir LOCAL_DIRECTORY` when available. A cancelled,
skipped, incomplete or failed run cannot substitute for a passing run. Record
new provenance when the code, workflow or baseline changes.
