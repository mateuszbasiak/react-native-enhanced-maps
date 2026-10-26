# Expo custom native builds

The config plugin integrates the package-owned MapLibre SDK with generated native
projects. The baseline is Expo 56.0.24, React Native 0.85.3 and React 19.2.3,
using expo-template-bare-minimum 56.0.38. This matches the package's RN 0.85.x
peer range. Newer Expo SDKs that change RN need separate compatibility validation.
Expo Go does not include this custom native package.

The package remains private and UNLICENSED. Install a locally packed tarball using
normal peer validation. If the optional GPU peers are absent, apply the documented
[core-consumer resolver override](native-consumers.md#optional-peer-resolver-constraint)
before installation. Core Expo maps do not require WebGPU or RN Worklets.

Add the plugin by package name:

```json
{
  "expo": {
    "plugins": ["react-native-maplibre-maps"]
  }
}
```

The plugin uses Expo's standard `withPodfile` mod. On iOS it resolves the installed
package hook through the exported `/app.plugin` entry and calls
`EnhancedMaps.post_install(installer)` before React Native's existing post-install
hook. Android continues to use native autolinking; the plugin does not add a second
SDK or another wrapper. Expo's baseline iOS 16.4 target exceeds the package's iOS
16 minimum. No provider keys or user-location permissions are added.

Repeated prebuilds keep one require block and one post-install call. Unknown or
ambiguous Podfile anchors, modified generated blocks and an existing manual
EnhancedMaps post-install integration reject with an explicit error. Remove a
manual integration before switching to plugin management. There are no plugin
options to override the pinned MapLibre SDKs.

## Reproduce the isolated consumer

From this repository, run:

```sh
npm run consumer:prepare:expo -- /absolute/new-empty-consumer-directory
```

The command builds and packs the current maps package, installs the exact Expo/RN
baseline and dev client, and downloads the pinned official SDK 56 template. It
runs prebuild against that template with CocoaPods installation disabled. An
existing nonempty output directory rejects; omitting the path creates a temporary
directory. The resulting app uses the packed package, not workspace symlinks.
Keep its generated package-lock.json with any recorded results.

The SDK 56 CLI can select a newer default template. Explicit template selection
avoids silently generating another SDK's project. For repeat prebuilds in the
prepared directory, use the downloaded template:

```sh
npx expo prebuild --no-install --template ./expo-template-bare-minimum-56.0.38.tgz
```

Install Pods from the generated ios directory, then build the generated projects:

```sh
# ios/
pod install
xcodebuild -workspace EnhancedMapsExpo.xcworkspace -scheme EnhancedMapsExpo -configuration Debug -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' -derivedDataPath build/DerivedData ARCHS=arm64 ONLY_ACTIVE_ARCH=YES CODE_SIGNING_ALLOWED=NO build
# Repeat with -configuration Release.

# android/ (with Android SDK and JDK configured)
./gradlew :app:assembleDebug :app:assembleRelease -PreactNativeArchitectures=arm64-v8a
```

Use x86_64 instead of arm64 for Intel simulator builds. The fixture uses distinct
bundle IDs (`org.enhancedmaps.expoconsumer` and `com.enhancedmaps.expoconsumer`) and
renders a geographic Circle plus a React-child Marker. A successful runtime check
requires `Expo map ready`, visible components and a working marker press; a build
alone is insufficient. Release startup must work without a Metro connection.

Physical-device, signed-device and minimum-OS device checks are maintainer-owned
follow-up and do not block feature completion. GPU-enabled Expo peers remain part
of the separate optional-GPU consumer matrix.

## Bounded verification, 2026-10-24–25

The installed tarball resolves through `plugins: ["react-native-maplibre-maps"]`.
Two SDK 56 prebuilds produced an identical Podfile and Ruby syntax checking passed.
Pure-transform contracts cover integration order, native setup preservation,
idempotence, CRLF and rejected malformed/ambiguous edits. Full local CI passed
102 contracts on the rebased feature stack, types, Codegen, packed
declarations/checks and production bundles.

The preparation command passed from empty directories using normal npm peer
validation, with no WebGPU or RN Worklets peer installed. The generated fixture
passes strict TypeScript checking. Attempting to reuse a nonempty directory rejects
before overwriting consumer files. CocoaPods installed 93 pods. Both native hosts
built Debug and Release ARM64 simulator/emulator apps with the package-owned
MapLibre pins (iOS 6.31.0 / Android 13.6.1).

On iPhone 17 Pro / iOS 26.1 and the session-owned Pixel 9a ARM64 / API 36 emulator,
both Debug apps reached `Expo map ready`, rendered the geographic circle and React
marker, and incremented `Marker presses: 0` to `1`. After stopping this session's
Expo Metro on port 8092 and confirming it refused connections, both freshly
installed Release apps passed the same readiness, rendering and marker-press
checks. Other unrelated Metro sessions were preserved.

The first unpinned prebuild selected a newer SDK template; it is not counted as
SDK 56 evidence. The explicit template repeated cleanly. The first Android Release
bundle failed because the fixture referenced an undeclared top-level
`babel-preset-expo`. Declaring the exact 56.0.21 preset fixed resolution; the repeated
Debug/Release build passed. A Debug iOS connection attempt initially failed because
Expo's localhost server bound only IPv6 while the native loader requested IPv4.
For this machine, the verified development server command was:

```sh
CI=1 REACT_NATIVE_PACKAGER_HOSTNAME=127.0.0.1 npx expo start --dev-client --lan --port 8092
```

For Android localhost access, reverse the selected port with
`adb -s <emulator-serial> reverse tcp:8092 tcp:8092`, then open the development
client URL. These are local development-server settings, not package/native
patches. The failed attempts are not counted as passes.

Rechecking after the geodesic feature merged caught a source-entry regression:
`mapContent.ts` imported a nonexistent `geodesic.js` source. The workspace example's
custom resolver had hidden it. The prerequisite Metro fix names the `.ts` source
and uses TypeScript's emitted-extension rewrite for compiled ESM; the example no
longer has that fallback. The final packed consumer includes that fix and uses
ordinary Expo Metro resolution. Initial Debug runtime smoke preceded that
geodesic merge; all four final native builds and the repeated Release runtime
checks passed after the import fix.

This completes core Expo integration for the tested baseline. It does not claim
other SDK/RN versions, GPU peer combinations, signed builds or device runtime
acceptance. No package was published.
