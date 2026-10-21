> Historical prototype record. Apple/Google experiments were removed in the package-owned MapLibre migration. See the root README and package source for the current API; earlier verification does not verify the migrated native implementation.

# Shared renderer experiment — dropped

The CPU shared renderer was removed after runtime measurements exposed costly SDK
projection per particle trail sample. The user chose SDK-native components and
accepted provider-specific zIndex limits. No shared renderer, native particle loop,
heatmap renderer or renderer stats callback remains in the implementation.

See [native-components.md](native-components.md) for the current API. A future GPU
renderer would need a fresh design and measured provider integration.
