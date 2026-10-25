# Polygon-hole picking fix

**Problem:** Both pinned native SDKs return fill hits inside polygon holes
(MapLibre Native #4783). Exact geographic simulator taps reproduced this for
ordinary native fill querying. JavaScript currently trusts the first native hit.

**Approach:** Post-filter polygon/multipolygon fill candidates in the native
selection loop using the returned geometry. Keep the pinned SDKs and public API.
Continue to the next candidate/lower interactive layer after a rejected hole hit,
then emit an ordinary map press if nothing remains. Do not merely drop callbacks
in JavaScript, which would lose native fall-through.

**Geometry:** Matching pure Java and C++ point-in-polygon helpers use planar
Mercator coordinates, subtract holes independent of winding, preserve explicit
unwrapped longitudes and test the query's applicable world copies. Hole boundaries
are excluded from fill; rendered outlines keep their existing line-layer picking.
Polygon features without holes and non-fill layers retain their SDK behavior.
Multipolygons with holes must accept another component that contains the point.

**Verification:** Write native fixtures first for fill, holes, reversed winding,
multiple holes, boundaries, dateline/unwrapped worlds, wide polygons and invalid
inputs. Run Java/C++ tests failing, implement helpers, then wire both native hosts.
Build both Debug apps and repeat exact geographic hole/outline/fill/map/lower-layer
press checks with ordinary public Polygon fixtures. Run full CI and independent
review; update contracts/results and publish a separate PR stacked above the stable shape-layer identity fix if that
prerequisite remains unmerged, using `gh stack`.
