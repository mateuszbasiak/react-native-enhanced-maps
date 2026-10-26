import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { configurePodfile } = require('../packages/maps/plugin/podfile.cjs');

const podfile = `require 'json'
platform :ios, '16.4'
prepare_react_native_project!
target 'HelloWorld' do
  use_expo_modules!
  config = use_native_modules!(config_command)
  use_react_native!(:path => config[:reactNativePath])
  post_install do |installer|
    react_native_post_install(installer, config[:reactNativePath])
  end
end
`;

test('Expo Podfile adds the package hook without replacing native setup', () => {
  const result = configurePodfile(podfile);
  assert(result.includes('react-native-maplibre-maps/app.plugin'));
  assert(result.includes('EnhancedMaps.post_install(installer)'));
  for (const line of podfile.trimEnd().split('\n'))
    assert(result.includes(line));
  assert(
    result.indexOf('maplibre-spm') <
      result.indexOf('prepare_react_native_project!'),
  );
  assert(
    result.indexOf('EnhancedMaps.post_install') <
      result.indexOf('react_native_post_install'),
  );
});

test('Expo Podfile transform is idempotent and preserves CRLF', () => {
  for (const original of [podfile, podfile.replaceAll('\n', '\r\n')]) {
    const once = configurePodfile(original);
    assert.equal(configurePodfile(once), once);
    assert.equal(once.includes('\r\n'), original.includes('\r\n'));
    assert.equal(once.split('EnhancedMaps.post_install(installer)').length, 2);
  }
});

test('Expo Podfile rejects missing or ambiguous template anchors', () => {
  for (const invalid of [
    podfile.replace('prepare_react_native_project!', ''),
    podfile.replace('post_install do |installer|', 'post_install do |other|'),
    podfile + 'prepare_react_native_project!\n',
    podfile + 'post_install do |installer|\nend\n',
  ])
    assert.throws(() => configurePodfile(invalid), /Unsupported Expo Podfile/);
});

test('Expo Podfile rejects partial or modified generated integration', () => {
  const once = configurePodfile(podfile);
  for (const invalid of [
    once.replace('EnhancedMaps.post_install(installer)', '# removed'),
    once.replace('# @generated end enhanced-maps-require', ''),
    once + '# @generated begin enhanced-maps-require\n',
    podfile.replace(
      '    react_native_post_install',
      '    EnhancedMaps.post_install(installer)\n    react_native_post_install',
    ),
  ])
    assert.throws(() => configurePodfile(invalid), /Enhanced Maps Expo/);
});
