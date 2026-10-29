# Native XYZ tile imagery

`UrlTile` is a direct `MapView` child (Fragments are supported) that renders
HTTP(S) raster imagery through MapLibre's native raster source and layer on iOS
and Android. It does not mount one React view per tile or restore the retired
public source/layer API.

```tsx
import { MapView, UrlTile } from 'react-native-maplibre-maps';

<MapView style={{ flex: 1 }} styleURL={styleURL}>
  <UrlTile
    id="weather"
    urlTemplate="https://tiles.example.com/{z}/{x}/{y}.png"
    tileSize={256}
    minimumZ={0}
    maximumZ={18}
    opacity={0.7}
    zIndex={0}
  />
</MapView>;
```

Templates must include `{x}`, `{y}` and `{z}`, use HTTP or HTTPS, and contain no
whitespace, fragments or other brace placeholders. Maximum length is 4096 UTF-16
code units. The scheme is XYZ (origin at the upper left); TMS, local file tiles,
TileJSON URLs, custom headers and offline downloads are outside this contract.
Unsupported props, including `flipY`, `maximumNativeZ` and
`shouldReplaceMapContent`, reject explicitly for JavaScript callers too.
Credentials and network permissions remain application-owned; native platform
transport policy still applies. Tile-server attribution and licensing remain the
application's responsibility.

`tileSize` defaults to 256 and must be a power of two from 64 to 1024. It configures
the native source's tile size, which affects which tile zoom is requested for a
given camera zoom. `minimumZ` and `maximumZ` are integer native source zoom bounds
from 0 to 22, defaulting to 0 and 22, with minimum no greater than maximum. The
native SDK can overzoom the maximum source level; these props do not set the
map's camera limits. Use MapView zoom settings to constrain the camera.

`opacity` defaults to 1 and must be within [0,1]. `visible` defaults to true;
`zIndex` defaults to 0 and must be finite. Larger zIndex draws later among tiles
and geographic shapes; equal values retain declaration order, including through
Fragments. Shape fill and outline remain together. React marker hosts use their
existing separate ordering system. Application layers are added over the base
style; arbitrary insertion among a style's labels is not exposed by this API.

Use an explicit stable `id` in changing lists; omitted IDs are positional.
IDs follow the existing map-content resource syntax (1–128 ASCII letters,
digits, `_`, `.`, `:` or `-`) and must not collide with another scene source or
the loaded base style. Each UrlTile uses its own native source/layer and shares the scene input validation contract without a serialized-byte cap; there is no fixed scene source/layer-count cap.

Changing source settings recreates native scene resources through the existing
scene update path. Hiding is a render setting, not a cache purge. Removal, style
replacement, remount and disposal use map-owned resource cleanup. Raster imagery
does not participate in marker clustering, feature picking or geometry fitting.
`fitElements()` with only tiles and no markers/shapes rejects for lack of fit
geometry. Invalid component input throws before native transport; native preflight
also rejects malformed raw raster definitions before replacing accepted resources.
There is no per-tile completion or tile-error callback guarantee.

## Repeatable Debug scenario

Run `node scripts/url-tile-fixture.mjs` from the repository root, start the normal
example Metro server on port 8088, and select `url-tiles`. The fixture serves a
white background style and deterministic red/blue PNGs on port 8099. iOS uses
loopback and the Android emulator uses `10.0.2.2`; this is simulator tooling, not
production server configuration. `/requests` reports a bounded request history.

The Debug-only `__enhancedMapsUrlTiles` interface exposes `snapshot`, `configure`,
`animate`, `reloadStyle`, `remount` and `fit`. Use it to check template/tile-size
changes, opacity, visibility, mixed shape ordering and resource cleanup. Readiness
means the map style is ready; it does not assert that every raster tile has loaded.
Physical-device performance and additional network/cache coverage remain
maintainer-owned follow-up.

## Acceptance — 2026-10-27

Implementation commit `8ac50ba` passed the following checks on iPhone 17 Pro /
iOS 26.1 and Android 16 / API 36 ARM64, using the deterministic local fixture.
Both native Debug builds succeeded. Each host passed eleven pixel-checked cases:
default red imagery, half opacity over white, hidden imagery, blue template
replacement, a shape above the tiles, tiles above the shape, tile removal,
restoration, style reload, map remount and a 512 tile-size source. Native fixture
error arrays remained empty. These samples prove the tested solid-color output
and ordering; they are not general visual alignment or performance measurements.

Additional native checks reject `fitElements()` when only tiles are present and
accept it when a geographic shape is present. With a 512 tile-size source bounded
to levels 4–6, both hosts show white at camera zoom 2 and blue at zoom 5 and 8.
The final overzoom requests use level 6. Camera-idle events confirm the requested
API zooms; the native accessibility zoom summary is not used as a numeric oracle.

Review regressions cover fragment-only XYZ templates, explicit rejection of
unsupported options and raster IDs resembling internal marker infrastructure.
The last case was reproduced as Android's `No value for revision` failure before
fixing native cluster-metadata enrollment; the final eleven-case matrix on both
rebuilt hosts uses that same raster ID. A Fast Refresh interruption of map
readiness was recorded, and the fitting/zoom probes were rerun after selecting a
fresh fixture generation. Recovering query readiness after source edits on an
already-ready map was subsequently fixed with a fresh native capability handshake;
see [Fast Refresh lifecycle acceptance](map-lifecycle-acceptance.md#fast-refresh-readiness-recovery-2026-10-28).

The clean generated-package check passes all 313 tests, strict type checks,
Codegen and packed declarations. The shared Android/Foundation scene preflight
corpus has 77 fixtures, including valid raster resources and malformed bounds,
styles, templates and source/layer combinations. Both production bundle checks
exclude Debug maps globals and configured maps secrets. Final code review found
no remaining actionable findings. Local ignored receipts retain native states,
sampled colors, screenshot paths, tile request history and binary provenance.

Integration with main commit `364b439` was checked on 2026-10-28 after the
callout, cluster-lifetime and marker-budget changes merged. Both native builds,
the full eleven-case matrix, geometry-only fitting checks and production bundle
checks pass on that combined implementation. The Examples picker opens the
fixture on both platforms. The separate initial source-zoom probes above were
run before this rebase; raster source-zoom code was unchanged by integration.
