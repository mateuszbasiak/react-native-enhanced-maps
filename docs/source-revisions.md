# GeoJSON source revisions

`GeoJSONSource` accepts an optional `revision`, a nonnegative JavaScript safe integer.
Revisions identify immutable full data replacements for a source ID within one map.

```tsx
<GeoJSONSource id="fleet" data={fleet} revision={fleetRevision}>
  <Layer id="fleet-dots" type="circle" style={{ circleRadius: 5 }} />
</GeoJSONSource>
```

Increase `fleetRevision` whenever the data changes. A higher revision may replace
its data, including replacing it with an empty collection. Equal revision and
unchanged serialized data permit style, ordering, visibility and callback changes.
Native comparison operates on normalized JSON rather than JavaScript object identity.
Clustering settings are also part of this identity: increase the revision when
changing `cluster`, radius, maximum clustering zoom or minimum points. A settings
change at the same revision is rejected before replacing the accepted index.

Both MapLibre hosts reject the whole incoming scene before removing existing
resources if a present versioned source has a lower revision, changed data at the
same revision, or no longer supplies its revision. The map reports a recoverable
`onError` with code `layer-scene` and retains its accepted scene and readiness.
Rejected batches do not advance any source's revision. SDK exceptions after resource
mutation are not transactional; this guarantee specifically covers revision rejection.

Omitting `revision` preserves unversioned replacement behavior for existing callers.
An unversioned source can opt in by supplying a revision. Generated Polyline,
Polygon and Circle sources stay unversioned. Revisions do not version marker props.

State is map-owned. Successfully removing a source from a scene ends that source's
revision lifetime; re-adding the same ID may start at zero. A source must actually
be applied as removed, rather than merely omitted in an intermediate React render.
Unmounting/remounting a map also starts fresh state. A basemap style reload retains
revision state and reconstructs the accepted scene if current props are rejected.
Android ignores obsolete style-request callbacks and closes its gate on disposal;
iOS verifies the loaded style identity and owns the gate in its non-recycled view.

This does not add incremental source patches, asynchronous indexing or a global
scene revision. Both hosts still rebuild scene resources. Large-update costs,
SDK rollback and full runtime lifecycle coverage remain separate work.

Tests: [transport and native runner](../tests/source-revisions.test.mjs),
[Java gate scenarios](../tests/native/SourceRevisionGateTest.java),
[C++ gate scenarios](../tests/native/SourceRevisionGateTest.cpp).

All replacements also obey the shared [scene input budgets](scene-budgets.md).
