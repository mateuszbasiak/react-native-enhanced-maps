#include "CameraOrigin.h"
#include <cassert>
#include <string>
int main() {
  using enhancedmaps::cameraOrigin;
  assert(std::string(cameraOrigin(false,false,false))=="unknown");
  assert(std::string(cameraOrigin(true,false,false))=="gesture");
  assert(std::string(cameraOrigin(false,true,false))=="application");
  assert(std::string(cameraOrigin(false,false,true))=="sdk");
  assert(std::string(cameraOrigin(true,true,true))=="gesture");
  assert(std::string(cameraOrigin(false,true,true))=="sdk");
  enhancedmaps::CameraOperationOrigin tracker;
  tracker.applicationBegan();
  assert(std::string(tracker.resolve(false,true,false))=="application");
  tracker.sdkBegan();
  assert(std::string(tracker.resolve(false,true,true))=="sdk");
  // A compass reset can finish with only Programmatic after canceling an app move.
  assert(std::string(tracker.resolve(false,true,false))=="sdk");
  tracker.applicationBegan();
  assert(std::string(tracker.resolve(false,true,false))=="application");
  tracker.sdkBegan(); tracker.gestureBegan();
  assert(std::string(tracker.resolve(true,true,false))=="gesture");
  assert(std::string(tracker.resolve(false,true,false))=="application");
  tracker.sdkBegan();
  assert(std::string(tracker.resolve(false,false,false))=="unknown");
  tracker.reset();
  assert(std::string(tracker.resolve(false,true,false))=="application");
  tracker.sdkBegan();
  tracker.applicationCallBegan();
  // Synchronous final callback can still carry the canceled compass reason.
  assert(std::string(tracker.resolve(false,true,true))=="application");
  tracker.applicationCallEnded();
  assert(std::string(tracker.resolve(false,true,false))=="application");
}
