package com.enhancedmaps;

/** UI-thread, map-owned provenance. SDK API_ANIMATION is also used for app commands. */
public final class CameraOriginTracker {
  private String origin = "unknown";
  private long nextCommand = 0;
  private long applicationCommand = 0;
  public long beginApplicationCommand() {
    applicationCommand = ++nextCommand;
    origin = "application";
    return applicationCommand;
  }
  public void finishApplicationCommand(long command) {
    if (applicationCommand == command) applicationCommand = 0;
  }
  public void gestureBegan() { applicationCommand = 0; origin = "gesture"; }
  public void sdkControlActivated() { applicationCommand = 0; origin = "sdk"; }
  public void begin(boolean gesture, boolean application, boolean sdk) {
    if (gesture) { gestureBegan(); return; }
    origin = applicationCommand != 0 && (application || sdk) ? "application"
        : sdk ? "sdk" : application ? "application" : "unknown";
  }
  public String consumeIdle() { String result = origin; reset(); return result; }
  public void reset() { origin = "unknown"; applicationCommand = 0; }
}
