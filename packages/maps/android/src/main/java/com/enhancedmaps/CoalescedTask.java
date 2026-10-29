package com.enhancedmaps;

import java.util.function.Consumer;
import java.util.function.Predicate;

/** UI-thread-only, one pending job per owner. Cancelled deliveries cannot consume a newer job. */
public final class CoalescedTask implements AutoCloseable {
  private final Predicate<Runnable> post;
  private final Consumer<Runnable> remove;
  private final Runnable work;
  private Runnable pending;
  private boolean closed;

  public CoalescedTask(Predicate<Runnable> post, Consumer<Runnable> remove, Runnable work) {
    this.post = post;
    this.remove = remove;
    this.work = work;
  }

  public void request() {
    if (closed || pending != null) return;
    Runnable task = new Runnable() {
      @Override public void run() {
        if (closed || pending != this) return;
        pending = null;
        work.run();
      }
    };
    pending = task;
    try {
      if (!post.test(task) && pending == task) pending = null;
    } catch (RuntimeException error) {
      if (pending == task) pending = null;
      throw error;
    }
  }

  public void cancel() {
    Runnable task = pending;
    pending = null;
    if (task != null) remove.accept(task);
  }

  @Override public void close() {
    closed = true;
    cancel();
  }
}
