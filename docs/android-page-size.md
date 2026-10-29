# Android 16 KB page alignment

The shader JNI target `em_shader_layer` explicitly links with both
`-Wl,-z,max-page-size=16384` and `-Wl,-z,common-page-size=16384`.
The example pins NDK 27.1.12297006, which needs explicit alignment settings.
See [Android page-size guidance](https://developer.android.com/guide/practices/page-sizes).

## Artifact verification

Extract the APK's `lib/arm64-v8a/*.so` and `lib/x86_64/*.so` to a temporary directory,
then run the verifier on the extracted files:

```sh
node scripts/check-android-page-size.mjs /absolute/extracted/lib/arm64-v8a/*.so
$ANDROID_HOME/build-tools/36.0.0/zipalign -c -P 16 -v 4 /absolute/app.apk
```

The verifier accepts little-endian ARM64/x86_64 ELF files, checks each LOAD
alignment and file/virtual-address congruence at 16 KB, and checks each GNU_RELRO
end. Missing RELRO is allowed. It checks binaries rather than inferring alignment
from CMake flags. It does not certify other ELF properties or 32-bit ABIs.

## Verification on 2026-10-29

The old ARM64 shader library failed with a 4096-byte LOAD alignment. After the
linker change, its three LOAD segments are 16384-aligned and its RELRO end is
`0x4c000`. The Debug APK passes `zipalign -c -P 16 -v 4`.

Build command:

```sh
npm run build:android -- -PreactNativeArchitectures=arm64-v8a -PreactNativeDevServerPort=8094 -PverificationApplicationIdSuffix=.pages
```

The isolated test build temporarily sets `android:pageSizeCompat="disabled"` on
the example application. This setting was confirmed in its merged manifest and
restored in source after building. No global device compatibility settings changed.
Small_Phone (Android 17/API 37 ARM64) reports `getconf PAGE_SIZE` = 16384.
The fresh `.pages` install starts, renders maps and runs the Shader lifecycle
scenario with the explicit diagnostic software adapter enabled. Both maps report
ready without errors. Two observations show produced/sample counts advancing
281/96 to 487/158; unmounting both maps returns output pool count to zero.
This is emulator acceptance, not hardware GPU or physical-device acceptance.

Ignored local receipts are in `artifacts/verification/android-page-size/`:
`runtime.json`, `sha256.txt`, `strict-manifest.xml` and `shader-elf.json`.

## Open dependency audit

This closes the package-owned shader linker defect. It does not establish that
all bundled dependencies pass the stricter RELRO audit. The tested APK has
16 KB LOAD alignment but fails the RELRO-end check for `libappmodules.so`,
`libc++_shared.so`, `libfbjni.so`, `libhermesvm.so`, `libimagepipeline.so`,
`libjsi.so`, `libnative-filters.so`, `libnative-imagetranscoder.so`,
`libreact-native-webgpu.so`, `libreactnative.so` and `libworklets.so`.
The shader, MapLibre, Hermes tooling and Dawn libraries pass both checks.

The current Android 17 emulator nevertheless starts with compatibility disabled;
that observation does not override the binary findings. Dependency updates or
rebuilds and a repeat of the whole-APK audit remain required. No consumer-wide
16 KB certification, x86_64 native runtime, or physical-device result is claimed.
