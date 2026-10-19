# React Native Enhanced Maps

A New Architecture native maps package in active feasibility development.
Stability, measurable performance, and a typed API are the priorities.

## Current implementation

- npm workspaces for the core maps package, optional TypeGPU companion, and bare native example.
- Typed Fabric MapView boundary with initial camera, camera command, events, and errors.
- Initial MapKit and Google Maps native adapters. See verification status in `docs/compatibility.md`.
- Type tests, runtime contract tests, native autolinking regression check, Codegen verification, production Metro bundling, and packed declaration-consumer checks.

This is **not a production release**. Layers, clustering, detailed gesture recognition,
and live TypeGPU shader layers remain required v1 work.
The GPU companion includes an experimental TypeGPU triangle baked to a native
geographic raster; it does not yet implement a live custom render pass.
No performance or react-native-maps drop-in compatibility claim is made.

Start with [development](docs/development.md), [contracts](docs/contracts.md),
and [the implementation plan](docs/plans/2026-10-19-feasibility-implementation-plan.md).

```sh
npm ci --ignore-scripts
npm run check
npm run example:bundle
npm run doctor
```

Packages remain private and UNLICENSED pending repository ownership, licensing,
and npm naming decisions. No publishing workflow is enabled.
