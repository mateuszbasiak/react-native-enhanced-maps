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
as `unvalidated`, and shaders as `unvalidated`, and symbol/heatmap as `unsupported`. Raster is `unvalidated`: the bounded native
`UrlTile` contract is implemented, with broader network/cache/performance
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

The parser, both native report constants and readiness state have executable
regressions. Both running simulators delivered reports and invalidated/restored
them during style replacement on 2026-10-20. Broader recovery and feature quality
gates still require coverage. These are feature-support reports, not automatic
performance or installed-dependency benchmarks.
