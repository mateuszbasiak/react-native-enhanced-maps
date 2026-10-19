# Compatibility and verification status

Initial baseline: React Native 0.85.3 / React 19.2.3, New Architecture only.
TypeGPU 0.12.8 and react-native-webgpu 0.17.0 are installed in the example, but
shader integration has not been implemented.

## Implemented checks

- TypeScript public contracts and expected compilation failures.
- Runtime provider/camera validation and JS revision lifetime contracts.
- Consumer CLI discovery for both native platforms.
- Codegen generation for iOS and Android.
- Packed tarball file checks and declaration resolution in a separate consumer.

Native build and runtime evidence will be recorded in `docs/verification.md`.
Generation is not native compilation; compilation is not device verification.

## react-native-maps baseline

Research baseline: npm 1.29.11. No dependency on react-native-maps is installed.
A full pinned API inventory is still pending. Current component is an initial
MapView spike; region props, children/markers, shape components, fit-to-coordinates,
callouts, snapshots, location tracking, and full event/method compatibility are
not implemented. Familiar naming does not establish drop-in compatibility.

## Open release constraints

- Native SDK/OS support ranges need device evidence before widening peer ranges.
- Google iOS 10.15.0 Pods integration is a temporary spike choice; assess current SPM distribution.
- Newer RN releases are not yet tested; only 0.85.x is declared as the initial peer range.
- No Expo config plugin, clean native tarball consumers, release-device benchmarks,
  clustering, layers, accessibility equivalents, or geographic GPU synchronization yet.
- Packages remain private/UNLICENSED; publishing is intentionally disabled.
