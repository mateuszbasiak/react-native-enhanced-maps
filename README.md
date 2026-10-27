# React Native MapLibre Maps

A package-owned React Native Fabric integration with MapLibre Native on iOS and Android.
The core package exports `MapView`, `Marker`, `Callout`, `Polyline`, `Polygon` and `Circle`; examples consume those exports. Apple Maps and Google Maps experiments
have been removed. No React Native MapLibre wrapper or dependency patches are required.

Custom markers accept React Native children. Android draws marker textures inside
MapLibre's render pass and keeps native children for input; bitmap captures happen
when content changes. iOS uses native annotation views. Layer ordering and marker
`zIndex` are owned by the package. Gesture arbitration and production performance
still need further verification.

```sh
npm ci --ignore-scripts
npm run example:pods         # macOS: Pods + package-owned MapLibre SPM hook
npm start                   # Metro on 8088
npm run example:ios          # in another terminal; or example:android
```

Examples use a MapLibre style URL. No Google credentials are needed. Tile/style
hosting can have its own terms, availability and costs.

```sh
npm run check               # types, contracts, Codegen, packed consumer checks
npm run example:bundle      # production JS bundles
npm run build:ios           # native simulator build
npm run build:android -- -PreactNativeArchitectures=arm64-v8a
```

See the [documentation index](docs/README.md) for current setup, API and validation
references, or [development](docs/development.md) for local commands.
Historical prototype documents describe earlier experiments and are not the current
API. Packages remain private and UNLICENSED; this is not a production release.

Shape props and compatibility limits: [shape components](docs/shapes.md).

Opt-in marker clustering uses `Marker.cluster` and optional `MapView.clusterComponent`.
Use `clusterGroup="boats"` to keep opted-in boats separate from other groups:

```tsx
<Marker id="boat-a" coordinate={boatA} clusterGroup="boats">
  <BoatPin />
</Marker>
<Marker id="boat-b" coordinate={boatB} clusterGroup="boats">
  <BoatPin />
</Marker>
<Marker id="marina" coordinate={marina} clusterGroup="marinas">
  <MarinaPin />
</Marker>
```

Only markers with the same group can cluster together; distance and zoom still
determine membership. Providing `clusterGroup` enables clustering unless
`cluster={false}` explicitly opts out. `cluster={true}` without a group uses the
shared default group. Omitting both props keeps a marker independent.
Group names must be nonblank strings of at most 512 characters; names compare
exactly. Custom cluster components receive `clusterGroup` (undefined for the
default group), count, coordinate, lazy `getMembers()` and `expand()`.
Each active group uses one native source and one layer, sharing the map's existing
64-source/128-layer limits with other content. There is no fixed marker-count cap; scene byte and geometry budgets still apply. Distinct groups can overlap visually at the same coordinate.
Changing a group rebuilds the indexes and invalidates previous cluster callbacks.
Sources and style layers are private implementation details.

Experimental world shader layers (`react-native-maplibre-maps/shaders`): [ShaderLayer contract](docs/shader-layer.md).

Development changes are tracked in [CHANGELOG.md](CHANGELOG.md). See
[contributing](CONTRIBUTING.md), [private security reporting](SECURITY.md) and
[prerelease policy](docs/release-policy.md).

Expo custom builds: [config plugin and isolated consumer](docs/expo.md).
