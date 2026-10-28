# Packed GPU native consumer

`npm run consumer:prepare -- --shaders` builds and packs the maps package and
prints an isolated native consumer directory outside the workspace. An optional
output directory follows `--shaders` and must not already exist. The consumer
uses the same derived native scaffold as the [core consumer](native-consumers.md),
with an unpacked tarball dependency, pinned WebGPU/Worklets peers, and the Worklets
Babel plugin. It uses `com.enhancedmaps.gpuconsumer` on both platforms, avoiding
replacement of the ordinary example. Debug and Release share that ID.

The shader fixture is `scripts/fixtures/native-gpu/App.tsx`. It renders a pulsing
rectangle over a map and retains a React marker. Controls pause/resume the shader,
hide/show it, submit invalid WGSL and restore the original program, unmount/remount
the map, and query the ordinary camera. Software adapters require an explicit
**Allow software** selection; that diagnostic mode is not hardware acceptance.

## Install and build

Use Node 22.13+ (the repository's pinned verification runtime is 22.17.1). In the
printed directory, run normal installation and verify the installed tree:

```sh
npm install --ignore-scripts --no-audit --no-fund
npx tsc --noEmit
npm ls --all
npx react-native config
```

Confirm maps is an ordinary directory in this consumer's node_modules, not a
workspace symlink, and that both optional native peers appear in autolinking.
The Reanimated resolver override is inherited from the core consumer. Local
maps credential/configuration files are excluded from scaffold copying; this
fixture uses the public OpenFreeMap style.

GPU consumers require **Android API 26+**, imposed by the pinned WebGPU peer.
Core consumers retain API 24. This does not establish minimum-OS runtime coverage.
With the Android SDK and JDK 17 configured, from `android/`:

```sh
./gradlew :app:assembleDebug :app:assembleRelease --no-daemon -PreactNativeArchitectures=arm64-v8a -PreactNativeDevServerPort=8096
```

On macOS, from `ios/`:

```sh
pod install
xcodebuild -workspace EnhancedMapsExample.xcworkspace -scheme EnhancedMapsExample -configuration Debug -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' -derivedDataPath build/DerivedData ARCHS=arm64 ONLY_ACTIVE_ARCH=YES CODE_SIGNING_ALLOWED=NO build
xcodebuild -workspace EnhancedMapsExample.xcworkspace -scheme EnhancedMapsExample -configuration Release -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' -derivedDataPath build/DerivedData ARCHS=arm64 ONLY_ACTIVE_ARCH=YES CODE_SIGNING_ALLOWED=NO build
```

Build configurations sequentially when disk space is limited. Keep generated
consumers, archives and build logs outside version control.

## Runtime acceptance

Start Metro from this consumer on port 8096 for Debug:

```sh
npx react-native start --port 8096
adb -s ANDROID_EMULATOR_SERIAL reverse tcp:8096 tcp:8096
SIMCTL_CHILD_RCT_METRO_PORT=8096 xcrun simctl launch --terminate-running-process IOS_SIMULATOR_UDID com.enhancedmaps.gpuconsumer
```

The iOS scaffold otherwise defaults to port 8088; always supply the environment
variable for this isolated Debug run. Confirm debugger `projectRoot` points to
the generated consumer and select each app's logical device ID when both hosts
share Metro. Install the Debug app on each simulator and verify actual
pulsing output, not just the `Packed shader ready` callback. Pause must freeze
the displayed color; Resume must restart it. Hide must remove shader output;
Show must initialize and render again. Invalid shader must report an error while
**Query core** still passes; **Correct shader** must restore rendered output.
Unmounting must remove the map and shader, and remounting must restore both.

Debug exposes `globalThis.__enhancedMapsPackedGPU` with `configure(patch)`,
`query()` and `snapshot()`. Configuration fields are `visible`, `paused`,
`invalid`, `software`, and `mounted`. Snapshot includes callbacks, errors and
native `diagnostics` counters. Require positive produced/sampled counters after
rendering and zero output pools after hide, failed compilation and unmount.
Wait for teardown to complete before reading counters. These are bounded pool
observations, not full native allocation/leak measurements.

For Release, install and cold-launch the bundled app with this consumer's Metro
server stopped. Repeat the UI checks. The Debug global and native diagnostic
methods must be absent from Release; use the existing compiled bridge verifiers
against this consumer to check exported native methods. Record builds, runtime
observations and software-adapter consent separately. Physical-device validation
remains maintainer-owned follow-up.

## Bounded acceptance — 2026-10-28

The source package baseline was `e438cebd05e931dbc10ca33a4c9702e0cb1746a0`.
The installed maps tarball SHA-256 was
`7ddeaefba4497fa0bf2ca2055587d99de965b0e562e63f0219ba847873151a46`;
fixture App.tsx SHA-256 was
`38449a21530bf5ef710a3ca0bdff1f0fd67d17c8249d0960c46da0ab02f9c839`.
The native fixture used the corrected API 26 minimum and the checked-in App.tsx;
these scaffold changes are outside the package tarball. Normal npm installation,
`npm ls --all`, consumer TypeScript and autolinking passed with Node 22.17.1,
React 19.2.3 / RN 0.85.3, WebGPU 0.17.0 and Worklets 0.12.2. Maps was unpacked
inside the consumer, not linked to the workspace. An initial install under the
shell's Node 18 emitted engine warnings; installation was rerun under Node 22
before the accepted checks.

Android arm64 Debug and Release builds passed with JDK 17 and Gradle 9.3.1.
iOS arm64 Simulator Debug and Release builds passed with Xcode 26.2 and signing
disabled. Runtime used iPhone 17 Pro / iOS 26.1 and the
EnhancedMapsVerification arm64 emulator / API 36. Android's first Debug build
failed because the core fixture's API 24 minimum conflicts with WebGPU API 26;
the corrected GPU generator retains API 26, while core generation stays API 24.
No manifest override was used. A slow CocoaPods artifact download was replaced
with the already cached, identical RN-version archives.

Both Debug hosts rendered the pulsing shader and marker. Native output counters
were positive (for example iOS produced/sampled 1793/2274, Android 854/98).
Two paused screenshots per host retained identical three-pixel samples across
approximately 16–17 seconds; samples changed after Resume. Hide released all
output pools. Invalid WGSL reported errors, and the ordinary camera query
succeeded while the shader was invalid. Correcting the program restored positive
produced/sampled counters; both hosts recovered after map remount. Settled invalid
compilation and final map disposal each had zero output pools. Android's invalid
compilation cleanup required a later settled observation; an earlier sample with
one pool was not counted as completed cleanup.

Both Release apps were installed and cold-launched after stopping the consumer's
Metro server on 8096. They rendered shader output and markers. UI checks passed
pause/resume, hide/show, invalid compilation with a successful core query,
correction, and map unmount/remount. Paused Release pixel samples remained exact
across approximately 24 seconds on iOS and 10 seconds on Android, and changed
after Resume. The query counter reached one during invalid compilation on each
host. Error text can resize the map and cause additional shader callbacks; callback
counts are observations, not an exactly-once contract or throughput measurement.
Android required explicit software-adapter consent in both configurations. This
is simulator software-GPU integration evidence, not physical GPU acceptance.

Both compiled bridge verifiers pass: Debug exports diagnostic counters and
Release omits them while retaining install/create/release transport. The verifiers
were updated from retired bridge acquire/publish and square-allocation selectors
to the current JSI/rectangular-allocation contract. Production bundle checks reject
the Debug fixture global on both platforms. Release bundle SHA-256 values:

- iOS: `ad82a20c56ac07cc845276470571c0391d48b47be73c73028aa9fe5b59c0c39b`.
- Android: `548abe51d21b819ce3356ffade36f5b65353471f82a430a288041d0eb87c2d68`.

Bounded runtime records and screenshots are local ignored artifacts under
`artifacts/gpu-consumer/`; generated consumer/build logs remain outside version
control. This completes the native GPU integration slice of REL-05 for the pinned
baseline. Projection/alignment, full composition/error matrices, native allocation
accounting, privacy beyond these checks, performance, minimum-OS runtime and
physical-device checks remain separate. No package was published.
