package com.enhancedmaps;

/** UI-thread-only native lifecycle. Window attachment and host activity are independent. */
public final class MapLifecycleGate {
  private final Runnable start;
  private final Runnable resume;
  private final Runnable pause;
  private final Runnable stop;
  private boolean attached;
  private boolean hostResumed;
  private boolean running;
  private boolean started;
  private boolean closed;

  public MapLifecycleGate(boolean hostResumed, Runnable start, Runnable resume, Runnable pause, Runnable stop) {
    this.hostResumed = hostResumed;
    this.start = start;
    this.resume = resume;
    this.pause = pause;
    this.stop = stop;
  }

  public boolean isRunning() { return running; }

  public void setAttached(boolean value) {
    if (closed) return;
    attached = value;
    reconcile();
  }

  public void setHostResumed(boolean value) {
    if (closed) return;
    hostResumed = value;
    reconcile();
  }

  public void close() {
    closed = true;
    reconcile();
  }

  private void reconcile() {
    boolean next = !closed && attached && hostResumed;
    if (next && !started) { started = true; start.run(); }
    if (next != running) {
      running = next;
      if (next) resume.run(); else pause.run();
    }
    // Keep the SDK's shared file source active across transient window detaches.
    // Host pause or disposal still releases that activation exactly once.
    if (started && (closed || !hostResumed)) { started = false; stop.run(); }
  }
}
