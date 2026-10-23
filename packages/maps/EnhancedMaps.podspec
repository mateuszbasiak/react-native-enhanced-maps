require 'json'
package = JSON.parse(File.read(File.join(__dir__, 'package.json')))
Pod::Spec.new do |s|
  s.name = 'EnhancedMaps'
  s.version = package['version']
  s.summary = 'Fabric native map views for React Native'
  s.homepage = 'https://www.npmjs.com/package/react-native-enhanced-maps'
  s.license = { :type => 'UNLICENSED' }
  s.author = 'Enhanced Maps contributors'
  # Local path consumers are supported; replace with the owned repository before publication.
  s.source = { :git => 'https://example.invalid/react-native-enhanced-maps.git', :tag => s.version }
  s.platforms = { :ios => '16.0' }
  s.source_files = 'ios/**/*.{h,m,mm}'
  s.frameworks = 'UIKit', 'CoreLocation', 'QuartzCore', 'IOSurface', 'CoreVideo'
  install_modules_dependencies(s)
end
