#pragma once
#include <limits>
namespace enhancedmaps {
// View-owned, UI-thread-only gate. Never dispatch dropped samples to JavaScript.
class CameraEventGate {
  double lastEmissionMs_ = -std::numeric_limits<double>::infinity();
  bool moving_ = false;
 public:
  void beginMovement() { if (!moving_) { lastEmissionMs_ = -std::numeric_limits<double>::infinity(); moving_ = true; } }
  bool finishMovement() { bool wasMoving = moving_; moving_ = false; return wasMoving; }
  bool shouldEmit(double nowMs, bool enabled, double intervalMs, bool finalPosition) {
    if (!enabled) return false;
    if (!finalPosition && nowMs - lastEmissionMs_ < intervalMs) return false;
    lastEmissionMs_ = nowMs;
    return true;
  }
  void reset() { lastEmissionMs_ = -std::numeric_limits<double>::infinity(); moving_ = false; }
};
}
