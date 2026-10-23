#include "CameraEventGate.h"
#include <cassert>
int main() {
  enhancedmaps::CameraEventGate gate;
  assert(!gate.finishMovement());
  gate.beginMovement();
  gate.beginMovement();
  assert(gate.finishMovement());
  assert(!gate.finishMovement());
  assert(!gate.shouldEmit(0, false, 100, true));
  assert(gate.shouldEmit(0, true, 100, false));
  assert(!gate.shouldEmit(99, true, 100, false));
  assert(gate.shouldEmit(100, true, 100, false));
  assert(gate.shouldEmit(101, true, 100, true));
  assert(!gate.shouldEmit(150, true, 100, false));
  gate.reset();
  assert(gate.shouldEmit(0, true, 100, false));
  gate.reset();
  int count = 0;
  for (int ms = 0; ms < 1000; ms++) if (gate.shouldEmit(ms, true, 100, false)) count++;
  assert(count == 10);
  assert(gate.shouldEmit(999, true, 100, true));
}
