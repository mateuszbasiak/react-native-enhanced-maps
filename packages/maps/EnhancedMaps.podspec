require 'json'
package = JSON.parse(File.read(File.join(__dir__, 'package.json')))
Pod::Spec.new do |s|
  s.name = 'EnhancedMaps'
  s.version = package['version']
  s.summary = 'Fabric native map views for React Native'
  s.homepage = 'https://www.npmjs.com/package/react-native-maplibre-maps'
  s.license = { :type => 'UNLICENSED' }
  s.author = 'React Native MapLibre Maps contributors'
  s.source = { :git => 'https://github.com/mateuszbasiak/react-native-maplibre-maps.git', :tag => s.version }
  s.platforms = { :ios => '16.0' }
  s.source_files = 'ios/**/*.{h,m,mm}'
  s.frameworks = 'UIKit', 'CoreLocation', 'QuartzCore', 'IOSurface', 'CoreVideo', 'ImageIO', 'Metal'
  install_modules_dependencies(s)
end
