# Enhanced Maps example

Bare React Native 0.85.3 application for native maps feasibility testing.
See [the development guide](../docs/development.md) for setup and native build commands.

From this directory, `npm start` starts Metro on port 8088. Use `npm run ios` or
`npm run android` in another terminal. The app provides map mounting, remounting,
provider selection on iOS, camera movement, and visible readiness/error state.

This is not yet the planned automated device scenario runner. GPU rendering,
clustering, and data layers are not implemented.
