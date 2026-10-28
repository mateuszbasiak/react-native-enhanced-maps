# Runtime map capability reports

`MapViewRef.getCapabilities()` returns a frozen native report for the currently
ready map, or `null` before readiness, during style replacement, after a fatal
error or after unmount. `onCapabilitiesChange` receives the report before
`onMapReady` runs, and receives `null` when a style change or fatal error invalidates
it. A recoverable scene rejection retains the report and command readiness.

```tsx
<MapView
  ref={mapRef}
  styleURL={styleURL}
  onCapabilitiesChange={(report) => setCapabilities(report)}
  onMapReady={() => console.log(mapRef.current?.getCapabilities())}
/>
```

The report identifies `engine: 'maplibre'` and the native `platform`, and includes
`layers`, `shaders` and `detailedGestures` using the existing evidence states:

- `supported`: implemented and backed by the required validation evidence.
- `unvalidated`: implemented, with validation/quality gates still open.
- `unsupported`: absent from the integrated native map API.

Both current hosts report circle/line/fill and detailed gesture lifecycle events
as `unvalidated`, along with shaders, raster and heatmap. Symbols remain
`unsupported`; Marker icons do not expose a style-spec SymbolLayer. The native
Heatmap component and bounded native `UrlTile` contract are implemented, with broader network/cache/performance
coverage separate from implementation.
This deliberately does not advertise every capability of the underlying MapLibre
SDK. The experimental ShaderLayer transport is available in native builds, but
requires optional WebGPU/Worklets peers and compatible GPU sharing features. The
report does not guarantee that a particular adapter or shader will initialize.

Reports originate in the native readiness events and are bounded, schema-checked
and frozen by JavaScript. A missing, malformed or platform-mismatched report emits
fatal `invalid-native-capabilities`, invalidates readiness and leaves the ref query
at `null`; it never guesses support from the platform. A per-map request revision
binds each ready event to its style change, including A→B→A URL reuse. Queued
reports from earlier requests or detached maps are ignored.

React effect replay (including Fast Refresh) clears JavaScript readiness and
requests a fresh native report for the retained style. The private handshake is
accepted only for the current activation and style; a fatal error or newer native
ready event supersedes it. A failed probe leaves commands unavailable until a
normal ready event. Recovery preserves the camera/style and does not emit another
`onMapReady` or replay initial camera setup. Callout selection is cleared during
cleanup; callouts can be opened again after recovery. Shader rendering pauses,
finishes owned layer teardown and restarts after the fresh report is accepted.
Ordinary queries and shader attachment remain readiness-gated during this work.

Both Debug simulators passed direct `MapView` source edit/revert checks on
2026-10-28. See [lifecycle acceptance](map-lifecycle-acceptance.md) for results and
limits.

The parser, both native report constants and readiness state have executable
regressions. Both running simulators delivered reports and invalidated/restored
them during style replacement on 2026-10-20. Broader recovery and feature quality
gates still require coverage. These are feature-support reports, not automatic
performance or installed-dependency benchmarks.
