#include "MarkerOrder.h"
#include <cassert>
#include <limits>
int main(){
  using enhancedmaps::compareMarkerOrder;
  assert(compareMarkerOrder(false,1000,8,true,-1000,1)<0);
  assert(compareMarkerOrder(true,-std::numeric_limits<double>::max(),1,false,std::numeric_limits<double>::max(),9)>0);
  assert(compareMarkerOrder(false,2,1,false,1,9)>0);
  assert(compareMarkerOrder(false,2,1,false,2,9)<0);
  assert(compareMarkerOrder(true,0,2,true,0,2)==0);
}
