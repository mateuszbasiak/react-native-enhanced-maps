const requireBlock = `# @generated begin enhanced-maps-require
maps_plugin = Pod::Executable.execute_command('node', ['-p',
  'require.resolve("react-native-enhanced-maps/app.plugin", {paths: [process.argv[1]]})',
  __dir__]).strip
require File.join(File.dirname(maps_plugin), 'maplibre-spm')
# @generated end enhanced-maps-require
`;

function configurePodfile(source) {
  const contents = source.replaceAll('\r\n', '\n');
  const prepare =
    contents.match(/^[ \t]*prepare_react_native_project![ \t]*$/gm) ?? [];
  const install = [
    ...contents.matchAll(/^([ \t]*)post_install do \|installer\|[ \t]*$/gm),
  ];
  if (prepare.length !== 1 || install.length !== 1)
    throw new Error(
      'Unsupported Expo Podfile: Enhanced Maps Expo requires one standard prepare and post_install block',
    );
  const indent = install[0][1] + '  ';
  const installBlock = `${indent}# @generated begin enhanced-maps-install
${indent}EnhancedMaps.post_install(installer)
${indent}# @generated end enhanced-maps-install
`;
  const markers = [
    'begin enhanced-maps-require',
    'end enhanced-maps-require',
    'begin enhanced-maps-install',
    'end enhanced-maps-install',
  ];
  if (markers.some((marker) => contents.includes(marker))) {
    if (
      !contents.includes(requireBlock) ||
      !contents.includes(installBlock) ||
      markers.some((marker) => contents.split(marker).length !== 2)
    )
      throw new Error(
        'Enhanced Maps Expo generated Podfile integration was modified; restore it before prebuilding',
      );
    return source;
  }
  if (contents.includes('EnhancedMaps.post_install'))
    throw new Error(
      'Enhanced Maps Expo found a manual Podfile integration; remove it before enabling the plugin',
    );
  const result = contents
    .replace(prepare[0], requireBlock + prepare[0])
    .replace(install[0][0], install[0][0] + '\n' + installBlock.trimEnd());
  return source.includes('\r\n') ? result.replaceAll('\n', '\r\n') : result;
}
module.exports = { configurePodfile };
