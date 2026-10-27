#pragma once
#include <cstdint>
namespace enhancedmaps {
inline int compareMarkerOrder(bool calloutA,double zA,uint64_t sequenceA,bool calloutB,double zB,uint64_t sequenceB) {
  if(calloutA!=calloutB)return calloutA?1:-1;
  if(zA!=zB)return zA<zB?-1:1;
  return sequenceA==sequenceB?0:sequenceA<sequenceB?-1:1;
}
}
