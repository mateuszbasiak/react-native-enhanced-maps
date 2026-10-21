#pragma once
namespace enhancedmaps {
// Native SDK flags may overlap; gesture evidence takes priority over programmatic bits.
inline const char *cameraOrigin(bool gesture, bool application, bool sdk) {
  return gesture ? "gesture" : sdk ? "sdk" : application ? "application" : "unknown";
}
// SDK controls can span cancellation callbacks and an internal programmatic move.
// Retain their operation ownership until a real package command or gesture begins.
class CameraOperationOrigin {
  bool sdkOperation = false;
  bool applicationCall = false;
public:
  void applicationBegan() { sdkOperation = false; }
  void sdkBegan() { sdkOperation = true; }
  void gestureBegan() { sdkOperation = false; }
  void applicationCallBegan() { applicationBegan(); applicationCall = true; }
  void applicationCallEnded() { applicationCall = false; applicationBegan(); }
  void reset() { sdkOperation = false; applicationCall = false; }
  const char *resolve(bool gesture, bool application, bool sdk) {
    if (applicationCall && (gesture || application || sdk)) return "application";
    if (gesture) { gestureBegan(); return "gesture"; }
    if (sdk) sdkBegan();
    return cameraOrigin(false, application, sdk || (application && sdkOperation));
  }
};
}
