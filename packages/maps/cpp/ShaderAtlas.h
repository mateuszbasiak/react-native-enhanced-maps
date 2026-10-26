#pragma once
#include <array>
#include <cstddef>
namespace enhancedmaps {
constexpr int kShaderAtlasSize=1024;
constexpr int kShaderAtlasColumns=4;
constexpr int kShaderTileSize=kShaderAtlasSize/kShaderAtlasColumns;
constexpr int kShaderTileGutter=2;
constexpr int kShaderTileInterior=kShaderTileSize-2*kShaderTileGutter;
constexpr int kShaderAtlasBytes=3*kShaderAtlasSize*kShaderAtlasSize*4;
inline std::array<float,2> shaderAtlasUV(std::size_t tile,int corner) {
 return {float((tile%kShaderAtlasColumns*kShaderTileSize+kShaderTileGutter+(corner%2)*kShaderTileInterior)/float(kShaderAtlasSize)),
         float((tile/kShaderAtlasColumns*kShaderTileSize+kShaderTileGutter+(corner/2)*kShaderTileInterior)/float(kShaderAtlasSize))};
}
}
