#include "PolygonHitTest.h"
#include <algorithm>
#include <cassert>
#include <limits>
using namespace enhancedmaps;
static HitRing ring(double west,double south,double east,double north) {
  return {{west,south},{east,south},{east,north},{west,north},{west,south}};
}
int main() {
  auto outer=ring(-5,-5,5,5), hole=ring(-1,-1,1,1);
  assert(containsFilledPolygon(3,0,{outer,hole}));
  assert(!containsFilledPolygon(0,0,{outer,hole}));
  assert(!containsFilledPolygon(9,0,{outer,hole}));
  assert(containsFilledPolygon(5,0,{outer,hole}));
  assert(!containsFilledPolygon(1,0,{outer,hole}));
  std::reverse(outer.begin(),outer.end()); std::reverse(hole.begin(),hole.end());
  assert(containsFilledPolygon(3,0,{outer,hole}) && !containsFilledPolygon(0,0,{outer,hole}));
  assert(!containsFilledPolygon(2.5,2.5,{outer,hole,ring(2,2,3,3)}));
  auto dateline=ring(170,-10,190,10), datelineHole=ring(178,-2,182,2);
  assert(!containsFilledPolygon(-179,0,{dateline,datelineHole}));
  assert(containsFilledPolygon(-175,0,{dateline,datelineHole}));
  assert(containsFilledPolygon(175,0,{dateline,datelineHole}));
  assert(!containsFilledPolygon(0,0,{dateline,datelineHole}));
  auto wide=ring(-170,-10,170,10);
  assert(!containsFilledPolygon(160,0,{wide,ring(159,-1,161,1)}));
  assert(containsFilledPolygon(145,0,{wide,ring(159,-1,161,1)}));
  assert(!containsFilledPolygon(179,0,{wide}));
  auto nan=std::numeric_limits<double>::quiet_NaN();
  assert(!containsFilledPolygon(nan,0,{outer}));
  assert(!containsFilledPolygon(0,0,{{{0,0},{1,1}}}));
  assert(!containsFilledPolygon(0,0,{{{0,0},{1,0},{nan,1},{0,0}}}));
  assert(!containsFilledPolygon(0,0,{}));
}
