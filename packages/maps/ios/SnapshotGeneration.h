#pragma once
#include <cstdint>
namespace enhancedmaps {
/** View-local snapshot ownership; invalidation must precede native cancellation. */
class SnapshotGeneration {
  uint64_t generation=0;
  bool active=false;
public:
  uint64_t begin() { active=true;return ++generation; }
  void invalidate() { active=false; }
  bool isCurrent(uint64_t token) const { return active && token==generation; }
};
}
