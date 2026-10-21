# MapLibre example

The example now consumes the package-owned `MapView`, `GeoJSONSource` and `Layer`
components. The earlier React Native MapLibre wrapper and its patch installer have
been removed, along with the Google basemap experiment and Apple/Google providers.

The native layers screen displays a Liberty basemap, a line route and circle fleet
features at 100, 1,000 or 10,000 requested points. It exercises camera transitions,
layer insertion before basemap labels, visibility, feature picking and remounting.
The custom markers screen exercises React Native children, updates, Pressable,
PanResponder and zIndex. These are scenarios for verification, not benchmarks.

Run `npm run example:pods`, start Metro with `npm start`, then launch either native
example. No Google credentials are needed. iOS SDK setup is owned by the core
package's MapLibre SPM hook; Android links the SDK directly.

SDK builds and runtime behavior must be checked after migration. Earlier wrapper
prototype verification is historical evidence only. Native symbol image APIs,
clustering, production performance and complete gesture arbitration remain future work.
