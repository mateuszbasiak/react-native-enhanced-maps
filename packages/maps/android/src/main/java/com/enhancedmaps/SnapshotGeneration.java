package com.enhancedmaps;
/** View-local snapshot ownership; invalidate before native cancellation. */
public final class SnapshotGeneration {
  private long generation;
  private boolean active;
  public long begin() { active=true;return ++generation; }
  public void invalidate() { active=false; }
  public boolean isCurrent(long token) { return active && token==generation; }
}
