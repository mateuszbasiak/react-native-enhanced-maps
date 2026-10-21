#include "GestureEventGate.h"
#include <cassert>
#include <limits>
using enhancedmaps::GestureEventGate;
auto next(GestureEventGate &gate,int kind,int phase,double time,double x) { return gate.next(kind,phase,time,x,x+1,true,50); }
int main() {
  GestureEventGate gate;
  assert(!next(gate,0,1,0,1)); assert(!next(gate,0,2,0,1));
  assert(!gate.next(0,0,0,1,2,false,50));
  auto begin=next(gate,0,0,10,1); assert(begin && begin->id==1 && begin->phase==0);
  assert(!next(gate,0,0,11,2)); assert(!next(gate,0,1,59,3));
  auto update=next(gate,0,1,60,4); assert(update && update->id==begin->id && update->phase==1);
  auto end=next(gate,0,2,61,5); assert(end && end->id==begin->id && end->phase==2 && end->x==5);
  assert(!next(gate,0,3,62,6));
  auto a=next(gate,0,0,100,1),b=next(gate,1,0,100,2); assert(a->id!=b->id);
  assert(!next(gate,0,1,110,9));
  auto cancelled=gate.cancelAll(111); assert(cancelled.size()==2 && cancelled[0].id==a->id && cancelled[0].x==9 && cancelled[0].phase==3);
  assert(gate.cancelAll(112).empty());
  auto resumed=next(gate,0,0,120,1); assert(resumed->id>b->id);
  gate.reset(); assert(!next(gate,0,2,121,1));
  next(gate,2,0,130,1); gate.next(2,1,131,1,2,false,50); assert(!next(gate,2,1,200,1));
  for(int kind:{-1,4}) assert(!next(gate,kind,0,200,1));
  for(int phase:{-1,4}) assert(!next(gate,0,phase,200,1));
  for(double invalid:{-1.,std::numeric_limits<double>::quiet_NaN(),std::numeric_limits<double>::infinity()}) assert(!next(gate,0,0,invalid,1));
  assert(!next(gate,0,0,200,std::numeric_limits<double>::quiet_NaN()));
  assert(!gate.next(0,0,200,1,2,true,15)); assert(!gate.next(0,0,200,1,2,true,1001));
  assert(!gate.next(0,0,200,1,2,true,std::numeric_limits<double>::quiet_NaN()));
  GestureEventGate other; assert(next(other,0,0,200,1)->id==1);
}
