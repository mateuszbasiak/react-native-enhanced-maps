# Packed bare native consumer

`npm run consumer:prepare` builds and packs the private core package, then prints a
new temporary consumer directory outside this repository. An optional absolute
output path must not exist or be inside the workspace. The fixture copies only
native example scaffolding, adapts ordinary node_modules paths and replaces the
example JavaScript with a minimal core map/marker/circle app. It does not link a
workspace package. This verifies packed integration using a derived scaffold;
it is not an independently generated RN template or an Expo consumer.

The fixture pins React/RN and development tools to the workspace lockfile. Its
`verification.json` records source commit, tarball SHA-256 and resolver constraints.
No optional GPU dependencies or Worklets Babel plugin are included by default.
Use `npm run consumer:prepare -- --shaders` for the separate
[GPU native consumer](gpu-native-consumers.md), which installs both peers and
requires Android API 26+.

## Run

After preparation, in the printed consumer directory:

```sh
npm install --ignore-scripts --no-audit --no-fund
npx tsc --noEmit
npx react-native config
npm ls react-native-worklets react-native-webgpu react-native-reanimated --all
```

The last command should report an empty tree (npm may return status 1 for no
matching packages). Confirm the maps dependency resolves inside this consumer's
node_modules and is not a symlink. Keep the generated lockfile for repeat runs.

With Android SDK/JDK configured, from the consumer's `android/`:

```sh
./gradlew :app:assembleDebug :app:assembleRelease -PreactNativeArchitectures=arm64-v8a
```

On macOS, from the consumer's `ios/`, install Pods and build each configuration:

```sh
pod install
xcodebuild -workspace EnhancedMapsExample.xcworkspace -scheme EnhancedMapsExample -configuration Debug -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' -derivedDataPath build/DerivedData CODE_SIGNING_ALLOWED=NO build
xcodebuild -workspace EnhancedMapsExample.xcworkspace -scheme EnhancedMapsExample -configuration Release -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' -derivedDataPath build/DerivedData CODE_SIGNING_ALLOWED=NO build
```

The package's MapLibre post-install hook is loaded from the installed tarball.
From the repository root, compiled bridge verifiers accept consumer paths:

```sh
node scripts/check-android-bridge.mjs /absolute/consumer/node_modules/react-native-maplibre-maps
node scripts/check-ios-bridge.mjs arm64 /absolute/consumer/ios
node scripts/check-ios-bridge.mjs x86_64 /absolute/consumer/ios
```

Install the Release app on the corresponding simulator/emulator and launch with
Metro stopped. The readiness label must read `Packed map ready`; the marker child
must show `Packed core map`. A build alone does not establish this runtime check.
The fixture retains the example bundle identifiers, so installing it replaces
that example app on the chosen simulator. Do not use a physical device implicitly.

## Optional peer resolver constraint

Plain clean installation reproduced ERESOLVE with npm 10.9.2, 11.5.2, 11.10.1 and
11.19.1. npm traversed optional WebGPU/Reanimated peers and selected Worklets 0.13,
conflicting with the package's supported 0.12.2 pin, even though GPU peers were
absent from the root manifest. Omitting optional dependencies did not avoid it.

The generated root manifest constrains `react-native-reanimated` to 4.6.0 through
`overrides`, whose peer range permits Worklets 0.12.x. Normal npm peer validation
then succeeds, and none of Reanimated, Worklets or WebGPU is installed. This is an
explicit resolver workaround, not a claim that broader Worklets versions work.
Do not hide the conflict with `--legacy-peer-deps` or `--force`. GPU-enabled
consumers require explicit peer installation. The [optional-peer matrix](optional-peer-consumers.md)
checks isolated installation, declarations and JavaScript bundles; native GPU
consumer builds and runtime acceptance remain separate.

## Bounded results, 2026-10-23

Source package: main commit `e6f73d8`, RN 0.85.3 / React 19.2.3, Node 22.17.1,
normal npm 11.5.2 peer validation with the documented override. The actual installed
package was unpacked, not linked, and optional GPU packages were absent.

- Declaration checking and autolinking passed outside the workspace.
- Android Debug and Release ARM64 builds passed. The Release APK declares minSdk
  24 / targetSdk 36; runtime smoke used Pixel 9a / API 36, not Android 24.
- iOS Debug and Release generic simulator builds passed with MapLibre 6.31.0.
  Release smoke used iPhone 17 Pro / iOS 26.1.
- Both Release apps reached `Packed map ready` and rendered the marker with the
  session Metro port stopped. Core shape code compiled and bundled; semantic
  shape/press acceptance is separate.
- Android compiled ReactMethod exports and iOS arm64/x86_64 compiled selectors
  and export metadata retained transport methods and omitted Release counters.

Initial Android packaging and iOS startup failed when the host ran out of disk
space. After removing this session's generated intermediates, both were repeated
successfully. The failed attempts are not counted as passes.

Packed core bare-consumer integration is complete for the supported baseline
verified above. GPU peer combinations, Expo and Release privacy beyond these
bridge counters remain separate work. Physical-device, minimum-OS device runtime
and signed-device checks are deferred to the maintainer and do not block core
integration completion or this PR's readiness. Ownership/license and publication
approval remain separate requirements. No hardware results are claimed and no
package was published.

## Source and compiled relative imports

React Native consumers resolve the package's TypeScript source entry. Relative
runtime imports must name source files that actually exist; do not use a `.js`
specifier to refer to a `.ts` source and rely on an example-only Metro fallback.
The geodesic helper uses an explicit `.ts` source import, and the pinned TypeScript
compiler rewrites it to `.js` in emitted ESM. The workspace example uses ordinary
Metro relative resolution so production bundling detects this class of consumer
regression. Packed-consumer bundling remains a separate integration check.
