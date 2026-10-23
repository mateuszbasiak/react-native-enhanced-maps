# Android Release build

From the repository root, with Node 22+, the configured JDK and Android SDK:

```sh
example/android/gradlew -p example/android :app:assembleRelease --no-daemon -PreactNativeArchitectures=arm64-v8a
```

The workspace hoists `hermes-compiler` into root `node_modules`. The example's
React Native Gradle configuration sets `hermesCommand` to that location and keeps
`%OS-BIN%` for the plugin's host-OS substitution. Changing the React app root to
find Hermes would also change entry-file and bundle resolution; the explicit
compiler path preserves the example's existing bundle root.

## Verification — 2026-10-23

The first ARM64 Release assembly failed after Metro bundling with “Couldn't
determine Hermesc location.” After setting the hoisted compiler path, the same
`:app:assembleRelease` command passed: 204 tasks, 141 executed, 63 up-to-date.
Baseline: RN 0.85.3, Hermes compiler 250829098.0.10, MapLibre Android OpenGL 13.6.1,
Gradle 9.3.1, macOS host with Android Studio JDK. The resulting artifact is
`example/android/app/build/outputs/apk/release/app-release.apk`.

This verifies compilation, Hermes bytecode bundling and APK assembly. It does not
establish physical-device performance, signed distribution or clean packed-consumer
acceptance. Physical-device Release testing is deferred to the maintainer.
