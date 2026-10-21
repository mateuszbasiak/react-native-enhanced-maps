package com.enhancedmaps;

/** Invalidates queued benchmark work when a user takes control of the camera. UI thread only. */
public final class MarkerBenchmarkSession {
  private int generation;
  private boolean animating;
  public int begin(boolean animate) { animating = animate; return ++generation; }
  public boolean isCurrent(int token) { return token == generation; }
  public boolean isAnimating() { return animating; }
  public void cancel() { animating = false; generation++; }
  public boolean cancelGesture() {
    if (!animating) return false;
    cancel();
    return true;
  }
  public void finish(int token) { if (isCurrent(token)) animating = false; }
}
