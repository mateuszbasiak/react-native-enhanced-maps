# Enhanced Maps example

Bare React Native 0.85.3 app consuming the workspace's core package exports.
The app contains custom marker and native source/layer scenarios using MapLibre.
Apple Maps and Google Maps experiments have been removed.

From the repository root, run `npm run example:pods` on macOS, then `npm start`.
In another terminal run `npm run example:ios` or `npm run example:android`.
Metro uses port 8088. No Google credentials are required.

See [development](../docs/development.md) for native build and verification commands.

Development builds expose Open clustering for the deterministic native cluster
fixture, separate cluster/point styles, high/low zoom, revision rejection, style
reload and remount controls. See [clustering](../docs/clustering.md).
