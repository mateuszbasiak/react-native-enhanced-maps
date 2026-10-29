# Native scene JSON preflight

Both native scene paths scan incoming JSON before platform parsing. The scan uses
constant auxiliary space and stack, with work linear in input length. It permits
at most 64 nested object/array containers across the complete scene envelope.
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

Shared raw-input Java/C++ fixtures exercise 64/65 boundaries, mixed containers,
the reproduced 100,000-level input, quote/backslash escapes, Unicode, literal
syntax, large flat arrays/strings, supported property nesting, and Android
single-quote/comment/unquoted-literal bypasses. The initial quote-only scanner
failed the bypass regressions; the corrected scanner passes both native runners.

`npm run check` passes 388 tests after integration with current main, lint/format, declarations, Codegen and packed
packages. ARM64 Debug builds pass on Android and iOS. Native runtime uses isolated
`.depthguard` apps on Small_Phone / Android 17 API 37 and iPad Pro 13-inch (M5) /
iOS 26.4, served by private Metro 8094.

Both hosts reject a raw 100,000-level property update with the same error, preserve
camera fitting to the accepted feature, and route a native tap to its original ID
`accepted`. A corrected scene then fits and routes a second tap to `repaired`.
Both bounded native runs finish with two passing checks and no unexpected errors.
Ignored evidence is `artifacts/verification/scene-json-depth/runtime.json`.

This closes the reproduced recursive-parser failure path. Native property-node
and string complexity, asynchronous SDK failure recovery, parsing/rebuild cost,
index memory and broader rendering acceptance remain separate requirements.
Physical-device validation is maintainer-owned follow-up.
