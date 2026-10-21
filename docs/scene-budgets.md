# Scene input budgets

The package rejects oversized scenes rather than truncating data. `compileScene`
checks the whole scene, including GeoJSON sources and generated Polyline/Polygon/
Circle sources, before returning native props:

- At most 64 sources and 128 layers.
- At most 50,000 declared coordinate positions across all sources.
- At most 100,000 positions weighted by layer references. Referencing a 25,000-point
  source from four layers uses the whole rendered-position budget, including hidden
  layers, which still consume scene resources.
- At most 4 MiB of UTF-8 serialized scene JSON, including feature properties and
  layer definitions. Multibyte Unicode counts as encoded bytes rather than UTF-16
  code units. Android and iOS independently reject this size before native JSON
  parsing or resource replacement, with recoverable `layer-scene` errors.

Existing per-source feature/property/geometry validation and the separate 64-shape/
10,000-shape-position limits still apply. Geographic circles contribute their
generated ring points, and a fill plus stroke counts its coordinates twice toward
the rendered-position budget. Shape antimeridian handling is unchanged.

Data is immutable. Position counts are weakly cached by data identity; replace
arrays/objects when geometry changes and increase an explicit source revision.
These limits bound input work and transport, not frame time or total memory. Both
native hosts still rebuild scene resources and Android inline tiling runs
synchronously. Worker indexing, incremental patches and release-device budgets
remain separate work.
