# Native scene JSON preflight

Both native scene paths scan incoming JSON before platform parsing. The scan uses
constant auxiliary space and stack, with work linear in input length. It permits
at most 512 nested object/array containers across the complete scene envelope.
This is the measured Foundation parser boundary on iOS 26.4 (build 23E244),
not a chosen memory or performance budget. Foundation accepts 512 and rejects
513 for object, array and mixed nesting. Android accepts 513 in the isolated
SDK probe; the shared ceiling preserves the supported cross-platform input range.
Brackets inside quoted strings do not count; escaped quotes and backslashes
preserve string boundaries. Supported per-feature property nesting remains 16;
a compiled fixture at that limit has 22 total container levels.

This is not a dataset-count or serialized-byte cap. The removal of those caps
remains in force. It does not truncate data or alter valid scene contents.

Outside double-quoted strings, the scan accepts JSON container/separator tokens,
`true`, `false`, `null` and JSON number syntax. It rejects unquoted string values,
single quotes and comments. Android's [framework parser is lenient](https://android.googlesource.com/platform/libcore/+/master/json/src/main/java/org/json/JSONTokener.java);
those forms could otherwise hide nesting by desynchronizing string boundaries.
The platform parser still validates full structural grammar and string escapes.
The scan is not a replacement JSON parser.

Failed preflight emits recoverable `layer-scene` error
`Invalid or overly nested scene JSON` before parsing or scene replacement.
The previously accepted sources, layers, fit geometry and picking remain active.
Corrected input can replace the scene normally. No public component/API is added.

## Verification — 2026-10-29

An isolated Android 17 framework-parser probe reproduced `StackOverflowError`
during parsing at 100,000 nested objects (600,001 characters), before this guard.
Depths through 50,000 happened to parse on that process; this is not a supported
parser threshold. The scene handler catches `Exception`, which does not catch
that stack error. A macOS Foundation probe rejected extreme input with an error;
that probe was not an iOS runtime result.

Shared raw-input Java/C++ fixtures exercise 512/513 boundaries, acceptance above
64, mixed containers, the reproduced 100,000-level input, quote/backslash escapes,
Unicode, literal syntax, large flat arrays/strings, supported property nesting,
and Android single-quote/comment/unquoted-literal bypasses. The initial quote-only
scanner failed the bypass regressions; the corrected scanner passes both runners.

The reproducible Foundation probe is `tests/native/PlatformJSONDepthProbe.mm`.
Compile it with the simulator SDK and run it inside a booted simulator:

```sh
xcrun --sdk iphonesimulator clang++ -arch arm64 -mios-simulator-version-min=16.0 -fobjc-arc -framework Foundation tests/native/PlatformJSONDepthProbe.mm -o /private/tmp/platform-json-depth-probe
xcrun simctl spawn <simulator-udid> /private/tmp/platform-json-depth-probe
```

The probe prints OS version, container kind, depth and the Foundation rejection
reason. On iOS 26.4, depth 513 fails with NSError 3840, “Too many nested arrays or
dictionaries”. This measurement establishes a parser compatibility constraint,
not a safe memory budget or a universal result for every OS version.

`npm run check` passes 392 tests, lint/format, declarations, Codegen and package
checks. ARM64 Debug builds pass on Android and iOS with the revised boundary.
On iPad Pro 13-inch (M5) / iOS 26.4, a debugger-free native run accepts a complete
512-container scene, rejects 513 and 100,000 while preserving native fitting and
feature picking, then accepts and picks a corrected scene: four checks pass.
Evidence is in the ignored `artifacts/verification/scene-json-depth/measured/`.

## Android boundary acceptance — 2026-10-30

Android's isolated SDK conversion accepts complete scenes through 513 containers;
512 remains the common Foundation-derived compatibility ceiling, not a measured
Android capacity limit. A new Small_Phone / Android 17 API 37 ARM64 run now passes
all four raw native UI checks: 512 accepted, 513 and 100,000 rejected recoverably
with the accepted fit/feature retained, and corrected input accepted. All four
checks report `fitPreserved: true`; presses return `accepted` three times and
`repaired` once, with exactly two expected `layer-scene` errors and no unexpected
error. The final UI reads “Passed 4 native scene checks”.

Both the integrated binary from `a70c5c8` (Overlay PR #98) and a separately
rebuilt main-only code baseline `00caff1` (merged #96) pass the four checks. The
main-only rerun establishes this evidence independently of unmerged overlay work.
It starts from
the Debug **Run parser boundary checks** button and uses only native accessibility
and taps during the four checks. A direct Metro connection selects the scenario
beforehand and reads the bounded snapshot after completion; no JavaScript
debugger is active during input. Receipts are in
`artifacts/verification/scene-json-depth/measured/android-main-runtime.json` and
`android-main-pass.png` (ignored local artifacts).

The emulator is locked to portrait for this run: its landscape logical size and
portrait physical size produced inconsistent tool tap coordinates. Native fixture
targets are projected/measured after layout. The previous API 37 Hermes null-read
crash and API 36 initialization timeouts are historical failed attempts, not
passes. The crash does not recur in this debugger-free run; its cause is still
unresolved, and this result does not claim a Hermes/debugger fix. Earlier
64-container-build checks remain historical evidence.

Native property-node and string complexity, asynchronous SDK failure recovery,
parsing/rebuild cost, index memory and broader rendering acceptance remain
separate requirements. Existing unrelated limits require their own measured or
platform justification. Physical-device validation is maintainer-owned follow-up.
