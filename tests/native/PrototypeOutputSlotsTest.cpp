#include "PrototypeOutputSlots.h"
#include <cassert>
int main() {
  enhancedmaps::PrototypeOutputSlots pool;
  assert(pool.beginRead()==-1);
  int a=pool.acquire();assert(a==0);assert(pool.publish(a));
  assert(pool.beginRead()==a);
  int b=pool.acquire();assert(b==1);assert(pool.publish(b));
  int c=pool.acquire();assert(c==2);assert(pool.publish(c));
  assert(pool.acquire()==b); // old front, no readers
  assert(pool.acquire()==-1); // a being read, b writing, c front
  pool.endRead(a);assert(pool.acquire()==a);
  pool.close();assert(!pool.publish(b));assert(pool.acquire()==-1);
  bool rejected=false;try { pool.publish(b); } catch(...) { rejected=true; }assert(rejected);
}
