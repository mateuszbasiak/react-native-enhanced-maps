cmake_minimum_required(VERSION 3.22.1)
project(em_shader_layer)
find_package(ReactAndroid REQUIRED CONFIG)
add_library(em_shader_layer SHARED ShaderLayer.cpp)
target_compile_features(em_shader_layer PRIVATE cxx_std_17)
target_include_directories(em_shader_layer PRIVATE maplibre-prototype ../../../../cpp)
target_link_libraries(em_shader_layer EGL GLESv3 android log ReactAndroid::jsi)
# NDK r27 and earlier need both flags for 16 KB LOAD and RELRO alignment.
target_link_options(em_shader_layer PRIVATE
  "-Wl,-z,max-page-size=16384"
  "-Wl,-z,common-page-size=16384"
)
