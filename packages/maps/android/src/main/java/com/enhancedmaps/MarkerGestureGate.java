package com.enhancedmaps;

/** UI-thread-only ownership for a complete Android touch stream. */
public final class MarkerGestureGate {
  private boolean active;
  private boolean reserved;
  public void begin(boolean markerTarget) { active = true; reserved = markerTarget; }
  /** True only when the SDK needs one cancellation after a late ownership claim. */
  public boolean claim() {
    if (!active || reserved) return false;
    reserved = true;
    return true;
  }
  public boolean isReserved() { return active && reserved; }
  public void end() { active = false; reserved = false; }
}
