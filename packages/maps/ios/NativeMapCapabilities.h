#pragma once
namespace enhancedmaps {
// Integrated host features; implemented layers remain unvalidated until quality gates pass.
inline const char *nativeMapCapabilitiesJSON() {
  return R"json({"engine":"maplibre","platform":"ios","shaders":"unvalidated","detailedGestures":"unvalidated","layers":{"circle":"unvalidated","symbol":"unsupported","line":"unvalidated","fill":"unvalidated","raster":"unvalidated","heatmap":"unvalidated"}})json";
}
}
