# Package-owned integration for MapLibre Native's binary Swift package.
require 'securerandom'
module EnhancedMaps
  MAPLIBRE_URL = 'https://github.com/maplibre/maplibre-gl-native-distribution'.freeze
  MAPLIBRE_VERSION = '6.31.0'.freeze
  def self.new_object(project, klass)
    loop do
      uuid = SecureRandom.hex(12).upcase
      next if project.objects_by_uuid.key?(uuid)
      object = klass.new(project, uuid)
      project.objects_by_uuid[uuid] = object
      return object
    end
  end
  def self.add_product(project, target)
    raise 'EnhancedMaps native target missing' unless target
    package = project.root_object.package_references.find { |p| p.is_a?(Xcodeproj::Project::Object::XCRemoteSwiftPackageReference) && p.repositoryURL == MAPLIBRE_URL }
    unless package
      package = new_object(project, Xcodeproj::Project::Object::XCRemoteSwiftPackageReference)
      package.repositoryURL = MAPLIBRE_URL
      project.root_object.package_references << package
    end
    package.requirement = { 'kind' => 'exactVersion', 'version' => MAPLIBRE_VERSION }
    unless target.package_product_dependencies.any? { |p| p.package == package && p.product_name == 'MapLibre' }
      product = new_object(project, Xcodeproj::Project::Object::XCSwiftPackageProductDependency)
      product.package = package
      product.product_name = 'MapLibre'
      target.package_product_dependencies << product
    end
  end
  def self.post_install(installer)
    add_product(installer.pods_project, installer.pods_project.targets.find { |t| t.name == 'EnhancedMaps' })
    installer.aggregate_targets.group_by(&:user_project).each do |project, targets|
      targets.each do |aggregate|
        next unless aggregate.pod_targets.any? { |pod| pod.pod_name == 'EnhancedMaps' }
        aggregate.user_targets.each do |target|
          # Remove the obsolete prototype wrapper hook from existing app projects.
          target.shell_script_build_phases.select { |phase| phase.name == "[MapLibre React Native] Remove MapLibre.xcframework-ios.signature" }.each(&:remove_from_project)
          add_product(project, target)
          name = '[EnhancedMaps] Remove MapLibre binary signature artifact'
          unless target.shell_script_build_phases.any? { |phase| phase.name == name }
            phase = target.new_shell_script_build_phase(name)
            phase.shell_script = 'rm -rf "$CONFIGURATION_BUILD_DIR/MapLibre.xcframework-ios.signature"'
            phase.always_out_of_date = '1'
          end
        end
      end
    end
  end
end
