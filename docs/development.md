# Development workflow

## Selected spike versions

Node 22.17.1 (minimum 22.13), npm 11.5.2, React Native 0.85.3, React 19.2.3,
TypeScript 5.9.3, TypeGPU 0.12.8, react-native-webgpu 0.17.0.
These are an initial test set, not a broad compatibility guarantee. Dependencies
are locked in package-lock.json. Native baselines: iOS 16 and Android 24 for core;
the GPU example requires Android 26. Google Android is pinned to 20.0.0.
Google iOS uses optional CocoaPods 10.15.0 for the spike. Google's newer 11.x
installation direction is Swift Package Manager; evaluate that before release.

Sources used when selecting versions:
- https://reactnative.dev/docs/turbo-native-modules-introduction
- https://wcandillon.github.io/react-native-webgpu/docs/getting-started/installation
- https://docs.swmansion.com/TypeGPU/integration/react-native/
- https://developers.google.com/maps/documentation/android-sdk/release-notes
- https://developers.google.com/maps/documentation/ios-sdk/release-notes

## JavaScript and package checks

Run from repository root:

```sh
npm ci --ignore-scripts
npm run check
npm run example:bundle
npm run doctor
```

`check` builds declarations, checks public type cases and the example, runs native
boundary contracts, checks consumer CLI autolinking, generates native code for both
platforms, and packs/installs tarballs into a temporary declaration consumer.
It does not build native SDKs or test device behavior.

`example:bundle` creates production JS bundles for both platforms without starting
Metro. `doctor` writes redacted tool/credential-presence information to
`artifacts/doctor.json`. Never reinstall node_modules while native builds are running.

No additional runtime npm dependencies are declared by either library. React and RN
are peers; the companion also peers on the core package, TypeGPU and WebGPU. The
example installs GPU dependencies for future validation. This does not imply that
GPU rendering is implemented or that native binaries are small: WebGPU brings Dawn.

## iOS

Prerequisites: Xcode, CocoaPods, Node, a supported simulator runtime. The example
uses CocoaPods rather than mixing SPM and Pods.

```sh
cd example/ios
pod install
cd ..
npm start
# In another terminal, from example/:
npm run ios
```

The example uses Metro port 8088 to avoid other local apps on 8081.
Use `EnhancedMapsExample.xcworkspace`. For command-line build-only verification:

```sh
cd example/ios
xcodebuild -workspace EnhancedMapsExample.xcworkspace \
  -scheme EnhancedMapsExample -configuration Debug -sdk iphonesimulator \
  -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath build/DerivedData CODE_SIGNING_ALLOWED=NO build
```

If a generated `.xcode.env.local` selects an old Node, update that ignored file to
use the selected Node executable. Do not commit a machine-specific path.

MapKit is the default and requires no Google API key. Google iOS is deliberately
not linked by default:

```sh
cd example/ios
ENHANCED_MAPS_GOOGLE_IOS=1 pod install
```

Put `GOOGLE_MAPS_IOS_API_KEY` and `GOOGLE_MAPS_ANDROID_API_KEY` in root `.env.local`,
then run `npm run example:configure` from root. This generates ignored native
configuration files; environment variables override local values. The tracked
Info.plist references the generated iOS build setting. Never commit actual keys.
The view reports a structured missing-key error;
it must not log the key. Enabling Google changes native dependencies and requires
rebuilding. A provider change requires a React remount (the example does this).

## Android

Prerequisites: JDK 17, Android SDK 36, Google Play-enabled emulator/device, and
ANDROID_HOME. Gradle resolves the pinned NDK/CMake requirements. The example
expects workspace dependencies at the repository root.

```sh
cd example/android
./gradlew :app:assembleDebug --no-daemon -PreactNativeArchitectures=arm64-v8a
cd ..
npm start
# In another terminal, from example/:
npm run android
```

Configure the local keys as above, or set `GOOGLE_MAPS_ANDROID_API_KEY` in the local environment before building. It is
passed through a manifest placeholder; use an appropriately restricted development
key. No location permission is requested by this spike. Missing credentials produce
an error rather than substituting another map provider.

## What to verify on a device

Open the example and observe the status. Test initial display, Move, Unmount/Mount,
Remount, navigation/background/resume, and provider switching on iOS. Readiness
means the provider reports loading/rendering, not merely that an SDK object exists.
Google may never report loaded when authentication/network configuration is invalid.
These manual controls are the beginning of the scenario app, not the planned
machine-readable scenario runner. Physical-device release benchmarks remain pending.

## GitHub Actions

`Package checks` runs on every push and pull request and supports manual runs from
GitHub's Actions page once the workflow is on the default branch. Two independent
Ubuntu jobs run `npm run check` and production Metro bundles for iOS/Android.
Node 22.17.1 and Temurin Java 17 are explicitly selected; the runner's C++ compiler
executes the native camera gate contracts. npm installs use the lockfile without
lifecycle scripts. No Google Maps keys or repository secrets are required.

Download `package-verification` for tarballs/check logs and `production-bundles`
for bundles/logs; artifacts are retained for seven days, including available logs
on failures. New runs cancel superseded runs for the same branch or pull request.
These checks compile the standalone Java/C++ gates, not full native SDK apps;
Xcode/Gradle SDK builds and device performance testing remain separate gates.
