module.exports = {
  dependency: {
    platforms: {
      android: {
        sourceDir: './android',
        packageImportPath: 'import com.enhancedmaps.EnhancedMapsPackage;',
        packageInstance: 'new EnhancedMapsPackage()',
      },
    },
  },
};
