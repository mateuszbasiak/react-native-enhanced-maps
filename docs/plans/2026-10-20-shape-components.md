# Shape components implementation plan

**Goal:** Expand package-owned Polygon/Polyline and add Circle with familiar RN Maps props.
**Architecture:** Compile descriptors to MapLibre fill/line layers on both platforms. Circles use 128 geodesic segments; radius is meters. Preserve existing IDs, geometry limits, ordering and validation. Optional IDs derive from declaration order. Typed press events carry coordinate, position and identifier; only tappable shapes consume presses.
**Tech stack:** TypeScript, React, Fabric Codegen, Kotlin, Objective-C++, MapLibre Native.

Approved shape slice on 2026-10-20. Existing working-tree migration is preserved.

1. Add failing contract cases for circle distance/closure and invalid geometry, line style transport, optional IDs, event dispatch and tappable filtering.
2. Extend mapContent/nativeShapes/compiler types, exports and public type tests. Support caps, joins, miter limit and dash lengths in logical points (convert to MapLibre width units). Keep unsupported geodesic lines, gradients and dash phase rejected.
3. Extend native style adapters and feature event payloads on Android/iOS. Skip noninteractive layers in hit testing so underlying tappable content remains reachable.
4. Add a runnable shape example and document limits; run npm run check, bundles and both native builds. Record actual verification and any device gaps.

Circle contract: center within Mercator latitude bounds, finite radius 0–1,000,000m; reject circles exceeding supported latitude. Longitude is unwrapped across the antimeridian to retain a short ring. 128 segments are an approximation, not an exact analytic circle. Zero radius produces empty geometry. Immutable inputs required. Existing default colors/widths remain compatible.
