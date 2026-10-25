> Historical prototype record. This is not the current public API or current acceptance evidence. Use the [public API reference](../packages/maps/docs/api.md), [shape contract](shapes.md) and [component clustering](clustering.md).

# Native source/layer scenario

Rebuild native binaries after installing dependencies (`example:pods`,
`build:ios`, `build:android`). Metro uses 8088. The example enables one source
containing a route and a polygon with a hole, rendered by a translucent fill and
two line layers. Initial layers are blue with a dark outline. The shader snapshot
is off and is independent of this scenario.

Run on Apple iOS, Google iOS and Google Android separately:

1. Verify a blue route and filled polygon, clear hole, and dark line outline.
2. Layer color changes to pink; Layer data replaces the route (revision increases).
3. Hide layers clears every shape; Show layers restores the current data/styles.
4. Layers off removes the source and dependents; Layers on recreates them.
5. Set Live off and use Camera path through zoom, heading and pitch. Native layers
   stay projected while changes stays fixed and idle increases.
6. Remount, unmount/mount and switch providers. Content returns without leftovers.
7. Reorder line layers using the development interface; putting the wide dark
   outline last covers the colored inner line. Restore normal order afterward.

Development controls live at `globalThis.__enhancedMapScenario`. Re-read it after
React updates for current closures. Controls: `layers(bool)`, `layerVisible(bool)`,
`layerColor(bool)`, `layerData()`, `layerOrder(bool)`, existing `live(bool)`,
`move(0..3)`, `remount()`, and `provider('apple'|'google')`.
Snapshot includes source revision, visibility, color and ordering state. It does
not expose a native allocation count; visual removal is not a memory-leak test.

Unit/type checks cover graph errors, immutable source replacement, geometry,
styles and source serialization reuse. Native builds and debug visual checks
are separate from release performance, numeric projection parity, large datasets,
feature picking and repeated lifecycle stress.
