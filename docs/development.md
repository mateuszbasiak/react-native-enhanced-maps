# Development workflow

Install with `npm ci --ignore-scripts`. The workspace contains the core maps package and a
bare React Native example with a react-native-webgpu shader prototype. Native integration belongs
to the core package; do not patch third-party React Native map wrappers.

```sh
npm run example:pods        # macOS: install React Native Pods + MapLibre SPM setup
npm start                   # Metro port 8088; keep running
npm run example:ios         # separate terminal; or example:android
npm run example:ios -- --simulator "iPhone 17 Pro"
```

Prerequisites: Node >=22.13, JDK 17, Android SDK 36; Xcode, CocoaPods and simulator
runtime for iOS. Android does not require Google Play Services. The example uses
public MapLibre styles; style/tile hosting requirements are separate from the SDK.

```sh
npm run build               # TypeScript packages and declarations
npm run check               # lint, formatting, types, contracts, Codegen, packages
npm run lint                # ESLint for JavaScript, TypeScript, and React Hooks
npm run lint:fix            # apply automatic ESLint fixes
npm run format              # format supported repository files with Prettier
npm run format:check        # check formatting without changing files
npm run example:bundle      # production bundles for iOS and Android
npm run build:ios           # Debug simulator app, no launch/signing
npm run build:android -- -PreactNativeArchitectures=arm64-v8a
npm run doctor              # tool availability; writes artifacts/doctor.json
npm run clean -- --dry-run  # preview generated-output cleanup
```

Native SDKs: Android MapLibre OpenGL 13.6.1; iOS MapLibre 6.31.0. Minimum iOS 16,
Android 24 (GPU companion example requires Android 26). iOS combines React Native
Pods with the package's `maplibre-spm.rb` post-install hook; open the generated
`EnhancedMapsExample.xcworkspace`. No Google keys or provider-specific pod variants.

Build output: `example/ios/build/DerivedData/Build/Products/Debug-iphonesimulator/`
and `example/android/app/build/outputs/apk/debug/`. Native subprocess logs still
redact local secrets left from older experiments. Existing ignored local key files
are preserved, but no longer configure the app.

`check` and production bundling do not verify native SDK compilation or device
behavior. After native changes build both platforms and exercise map loading,
camera movement, custom marker updates, presses, dragging, zIndex, remounting and
background/resume. Record any remaining input arbitration or performance limits.

## Repository automation

GitHub runs lint/Prettier, package checks, production bundles, and separate Android
ARM64 Debug and iOS simulator Debug builds on pushes and pull requests. Native build
logs are retained for seven days. iOS CI uses Xcode 16.4 on macOS 15 and the runner's
CocoaPods installation, with `pod install --deployment` to enforce `Podfile.lock`.
These compilation checks do not replace device smoke tests or release builds.

`npm run check:packages` runs the types, contracts, Codegen, and packaging checks.
CI uses this command so lint and Prettier run only in their dedicated job;
`npm run check` still includes everything for local use. Node comes from `.nvmrc`.

Dependabot checks npm workspaces, GitHub Actions, the example's Gradle project,
and its Ruby dependencies weekly. Updates require review; they are not auto-merged.
`.editorconfig` provides shared whitespace defaults for editors that support it.

The task completion hook runs `scripts/check-quality.sh`: Prettier writes formatting
first, then ESLint checks the result. Both commands run even if one fails, and the
script returns a failure status if either fails. Cursor uses `.cursor/hooks.json`;
Codex uses `.codex/hooks.json`. In Codex, review and trust the project hook through
`/hooks` before expecting automatic execution. The script can also be tested with
`printf '{}' | bash scripts/check-quality.sh`. A direct script test does not prove
that the editor has loaded and trusted the lifecycle hook.

## Release shader diagnostics

Development shader counters (`EMShaderLayer.diagnostics` and bridge `stats`) are
Debug-only exports. Android uses separate Debug/Release module classes; iOS gates
these exports with `DEBUG`. The worklet transport retains its private error check
in both configurations so rendering failures still propagate.

After building both Android Kotlin variants, run `npm run verify:android:bridge`.
The command inspects annotated methods declared on the concrete compiled module class and rejects
Release counter exports or missing runtime transport methods. Build the variants
from `example/android` with
`./gradlew :react-native-enhanced-maps:compileDebugKotlin :react-native-enhanced-maps:compileReleaseKotlin`.
Use JDK 17 or the configured Android Studio JDK. This bounded check does not close
the wider Release-consumer privacy and diagnostics acceptance gate.

After iOS Debug and Release simulator builds in the default DerivedData directory,
run `npm run verify:ios:bridge` (append `-- x86_64` on an Intel Mac). It inspects
compiled module selectors and React Native export metadata, requiring Debug
counters, absent Release counters and retained runtime transport in both variants.
