# Internal sources and layers

Sources and MapLibre style layers are private rendering infrastructure. The
package root does not export `GeoJSONSource`, `Layer`, `LineLayer`, `FillLayer` or
GeoJSON source types. Applications use [Polyline, Polygon and Circle](shapes.md),
React-child [Marker](../packages/maps/docs/api.md) and opt-in
[marker clustering](clustering.md). Experimental [ShaderLayer](shader-layer.md)
uses the separate `/shaders` entry.

The shared shape compiler creates immutable geographic data and native circle,
line and fill descriptors. MapLibre owns projection and drawing. Shapes use stable
map-scoped IDs, zIndex/declaration ordering, visibility and typed press callbacks.
[Stable layer identity](shape-layer-identity.md) and
[polygon-hole picking](polygon-hole-picking.md) document the current native fixes.

[Source revisions](source-revisions.md), [scene budgets](scene-budgets.md) and
[feature picking](feature-picking.md) describe internal transport constraints.
Their native tests remain useful without exposing a general style-spec API.
Both hosts still rebuild scene resources; parsing and update performance remain
checklist work. Numeric geometry validation does not establish complete wrapping,
polar or self-intersection parity.

The approved [v1 rendering contract](rendering-contract.md) maps the remaining
requirements to RN Maps-compatible `Heatmap`, `Overlay`, `Geojson`, `UrlTile`,
`WMSTile` and `LocalTile`. Initial implementations are exported; see
[current support and limits](rn-maps-rendering.md). Icons/labels use `Marker`;
expressions and sources/layers stay private. Component props replace generic
public filtering and zoom APIs. Full implementation/acceptance remains open
under LAYER-03/06–09 and SRC-02.
