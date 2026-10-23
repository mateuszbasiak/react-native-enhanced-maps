package com.enhancedmaps;

/** View-owned, UI-thread-only gate. No queues, timers, or per-callback allocations. */
public final class CameraEventGate {
  private double lastEmissionMs = Double.NEGATIVE_INFINITY;
  private boolean moving = false;
  public void beginMovement() { if (!moving) { lastEmissionMs = Double.NEGATIVE_INFINITY; moving = true; } }
  public boolean finishMovement() { boolean wasMoving = moving; moving = false; return wasMoving; }
  public boolean shouldEmit(double nowMs, boolean enabled, double intervalMs, boolean finalPosition) {
    if (!enabled) return false;
    if (!finalPosition && nowMs - lastEmissionMs < intervalMs) return false;
    lastEmissionMs = nowMs;
    return true;
  }
  public void reset() { lastEmissionMs = Double.NEGATIVE_INFINITY; moving = false; }
}
