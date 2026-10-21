const path = require('node:path');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
module.exports = mergeConfig(getDefaultConfig(__dirname), {
  watchFolders: [path.resolve(__dirname, '..')],
  resolver: {
    nodeModulesPaths: [path.resolve(__dirname, '../node_modules')],
    // Published ESM uses .js imports; the workspace exposes the TypeScript sources.
    resolveRequest(context, moduleName, platform) {
      try {
        return context.resolveRequest(context, moduleName, platform);
      } catch (error) {
        if (moduleName.startsWith('.') && moduleName.endsWith('.js')) {
          return context.resolveRequest(
            context,
            moduleName.slice(0, -3),
            platform,
          );
        }
        throw error;
      }
    },
  },
});
