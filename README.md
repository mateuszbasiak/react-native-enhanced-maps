# React Native Enhanced Maps

A package-owned React Native Fabric integration with MapLibre Native on iOS and Android.
The core package exports `MapView`, `Marker`, `GeoJSONSource`, `Layer`, `Polyline`, `Polygon` and `Circle`; examples consume those exports. Apple Maps and Google Maps experiments
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

See [development](docs/development.md) and the
[package migration plan](docs/plans/2026-10-20-package-owned-maplibre.md).
Historical prototype documents describe earlier experiments and are not the current
API. Packages remain private and UNLICENSED; this is not a production release.

Shape props and compatibility limits: [shape components](docs/shapes.md).
