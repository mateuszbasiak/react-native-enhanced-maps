# Package-owned MapLibre renderer

Status: direction requested by the user on 2026-10-20. Implementation migration
starts from the validated custom-marker prototype; the native bridge migration
has not yet been implemented or verified.

## Ownership boundary

`packages/maps` remains the core `react-native-enhanced-maps` package. It should
depend directly on upstream MapLibre Native for Android and iOS, own its React
Native Fabric bridge, and export the components consumed by examples. Do not
implement the core backend by patching `@maplibre/maplibre-react-native`, copying
its private MarkerInfo types into core, or keeping a postinstall source rewrite.
A permanent fork of the RN wrapper is not the chosen ownership model.

Keep upstream rendering, projection, style parsing, camera and tile loading.
Own component mounting, view lifetime, marker capture/invalidation, gesture
arbitration, marker ordering, event contracts and resource cleanup.

## Core API direction

Use the existing package MapView/camera/error contracts where compatible. Add a
MapLibre renderer/backend explicitly; it must not pretend to be a Google or Apple
SDK provider. Renderer ownership and the basemap data/style source are separate
concepts. Preserve legacy provider experiments during migration until their
replacement/removal is deliberate.

Export Marker from the core package, accepting a coordinate, finite zIndex and
arbitrary regular React Native children. Preserve standard RN/RNGH integration
without inventing a MarkerGesture wrapper. Android visuals use change-driven
subtree capture into map-rendered textures; the mounted RN subtree owns state,
layout and responder participation. Higher marker zIndex wins; equal values use a
stable mount sequence. Draw order and input order share that contract. Map camera
movement must not trigger bitmap capture.

The public marker API must not expose MapLibre-specific IDs, source/layer handles,
patched wrapper props, or imperative bitmap-refresh requirements.

## Migration slices and acceptance

1. Own native map host: add package Fabric map component backed directly by the
   MapLibre Native SDK on each platform, with style loading, initial camera,
   camera commands/events, lifecycle cleanup and errors. Export and consume it
   from an example before moving marker rendering.
2. Own marker host: add package Fabric child mounting, coordinate/anchor/order
   state and invalidation observer. Replace the prototype's dependency-private
   MarkerInfo coupling with package-owned state.
3. Move texture composition and hit ordering into that host. Validate idle/camera
   zero-capture behavior, live child changes, overlap picking, finite/negative/
   equal zIndex values, remove/re-add, style replacement and map remounts.
4. Integrate existing package map-content descriptors with MapLibre native
   layers, preserving explicit ordering capabilities and errors.
5. Migrate custom-marker and MapLibre examples to imports from the core package.
   Delete the example Marker adapter, RN MapLibre wrapper dependency and
   postinstall patches only after their consumers are migrated and native builds
   and runtime checks pass.

Native tests and a fresh installed consumer build must prove no patching step is
needed. Document unsupported software-capture content (independent native
surfaces/hardware-only effects) and measured CPU/memory costs. Input arbitration
is still an open requirement, not a solved result of texture synchronization.

## Current verification boundary

Native verification was retried on 2026-10-20 after the earlier approval-review
usage limit. Fresh Android ARM64 and iOS simulator builds passed. Android installed
APK testing verified priority reversal, negative values, equal-value mount-order
ties, removal/re-addition and map remounting with matching visual/Pressable order.
The stable native construction sequence resolves the earlier Android tie defect.
Workspace checks passed with 54 tests. These results verify the prototype, not the
package-owned bridge migration described above.

## Migration build verification — 2026-10-20

Core now owns both native hosts and marker implementations. The Apple/Google
adapters, Google basemap experiment, wrapper dependency and patch installer are
removed. Fresh Android ARM64 and iOS arm64/x86_64 simulator builds passed.
`npm run check` passed (37 contract tests), including Codegen and packed declaration
consumer checks; production bundles passed for both platforms. Android runtime
smoke verified basemap, native sources/layers and a live marker Pressable update.
Full gesture, synchronization, zIndex, performance and clean external native
consumer verification remain separate checks; prototype evidence above does not
substitute for them.

An iOS smoke test caught stretched Fabric-shell sizing shifting annotation content.
The correction sizes and anchors annotations from the actual child bounds and
observes child size changes. Rebuilt iOS app shows markers at the reference dots;
Pressable counter updates were observed on both platforms. Broader runtime checks
listed above remain outstanding.
