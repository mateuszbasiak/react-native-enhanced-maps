# World ShaderLayer and worklet implementation plan

Approved scope: global Mercator coverage with anchored output tiles, one layer-wide optional compute pass and persistent GPU state, worklet-driven rendering immediately. A spherical globe/polar coverage and weather dataset streaming are separate features.

Architecture:

- One dedicated Worklets runtime per mounted layer; shared native output accessed through a serializable JSI HostObject, never per-frame RN bridge calls.
- One bounded 1024² triple-buffered atlas per layer: up to sixteen 252² tile interiors with two-pixel borders. Choose a lower tile zoom to fit the visible area plus a margin within the budget. Native projection supplies view bounds directly to the worklet and composites atlas tiles with the current camera transform.
- WGSL builtins supply shared time, tile world coordinates and view bounds. Longitude repeats; Mercator latitude is bounded. Tile-border sampling uses consistent world coordinates.
- Optional compute entry point updates one storage buffer once per frame. Rendering draws the same persistent state into every relevant tile, including crossed edges. Example wind particles keep positions and trail endpoints in that shared buffer.
- Shader/geometry edits recreate a layer; ordinary uniform updates and camera/tile changes preserve simulation state. Worklet control packets handle pause, background state and cancellation.

Steps:

1. Add red tests for tile selection/wrapping/budgets/gutters and shared native state lifecycle.
2. Implement bounded shared tile state and per-runtime JSI handle on iOS/Android, plus atlas composition.
3. Install Worklets/plugin; implement compute/render ownership and synchronous native publish without the RN thread.
4. Adapt ShaderLayer contract/context/example and document shader bindings/limitations.
5. Run contracts, package checks, bundles, both native builds and simulator continuity/JS-stall smoke tests. Review and resolve findings before reporting completion.
