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

Symbol/icon, raster/tile, heatmap, expression/filter and zoom-range requirements
remain open under LAYER-03/06–09 and SRC-02. Their component contracts must be
reconciled before implementation. The underlying SDK's capabilities do not make
those APIs available through this package. Historical source/layer usage examples
are preserved in Git history rather than offered as current installation examples.
