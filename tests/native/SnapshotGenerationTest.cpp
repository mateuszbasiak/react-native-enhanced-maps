#include "SnapshotGeneration.h"
#include <cassert>
int main() {
  enhancedmaps::SnapshotGeneration first,second;
  assert(!first.isCurrent(0));
  auto other=second.begin();
  for(int i=0;i<100;++i) {
    auto interrupted=first.begin();
    assert(first.isCurrent(interrupted));
    first.invalidate();
    assert(!first.isCurrent(interrupted));
    assert(second.isCurrent(other));
    auto next=first.begin();
    assert(!first.isCurrent(interrupted));
    assert(first.isCurrent(next));
    first.invalidate();first.invalidate();
    assert(!first.isCurrent(next));
  }
}
