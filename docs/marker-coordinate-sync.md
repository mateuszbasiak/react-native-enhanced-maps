# Android marker coordinate synchronization

Marker pixels and scene features already draw in MapLibre's render pass, but they
previously received geometry through independent asynchronous GeoJSON tile updates.
Marker geometry also waited for the next Choreographer callback after Fabric props
changed. A source/layer reference dot could therefore move before marker pixels.

Existing marker geometry is now submitted at the native prop commit through
`EMMarkerTexture.updateCoordinate()`. Both marker point sources and inline scene
sources use MapLibre's synchronous GeoJSON update option so their data does not
arrive through independent worker completions. Initial bitmap creation and later
content captures remain in the existing dirty-revision path. Coordinate changes
reuse the bitmap. Inline geometry parsing/tiling now runs synchronously on data
updates; large, frequently replaced scenes need performance measurement. This is
not a zero-cost or per-frame streaming-data guarantee.

On 2026-10-20 the Android ARM64 native build passed. A recorded regression flow
reproduced separation before the change. The final variable-rate recording had
zero separated frames (43 decoded frames, two visible position transitions).
Eight injected taps coalesced to those two transitions, so this is a smoke check,
not an eight-transition throughput or 60fps benchmark. Capture diagnostics stayed
at one initial capture/upload for each marker through movement. Evidence is under
`artifacts/verification/android-marker-coordinate-sync/`; the repeatable input flow
is `.argent/flows/android-marker-coordinate-update.yaml`.

Reference: https://maplibre.org/maplibre-native/android/api/-map-libre%20-native%20-android/org.maplibre.android.style.sources/-geo-json-options/with-synchronous-update.html
