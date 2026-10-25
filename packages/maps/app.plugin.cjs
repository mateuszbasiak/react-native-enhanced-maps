const { createRunOncePlugin, withPodfile } = require('expo/config-plugins');
const { configurePodfile } = require('./plugin/podfile.cjs');
const { name, version } = require('./package.json');

function withEnhancedMaps(config) {
  return withPodfile(config, (result) => {
    result.modResults.contents = configurePodfile(result.modResults.contents);
    return result;
  });
}
module.exports = createRunOncePlugin(withEnhancedMaps, name, version);
