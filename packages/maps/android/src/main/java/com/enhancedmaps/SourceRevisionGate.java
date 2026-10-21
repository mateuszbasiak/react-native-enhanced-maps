package com.enhancedmaps;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/** Map-owned, UI-thread-only accepted source state. Validation never advances state. */
public final class SourceRevisionGate {
  public static final class Source {
    public final String id;
    public final Double revision;
    public final String data;
    public Source(String id, Double revision, String data) {
      this.id = id; this.revision = revision; this.data = data;
    }
  }
  private Map<String, Source> accepted = new HashMap<>();
  private boolean closed;

  public void validate(List<Source> sources) {
    if (closed) throw new IllegalStateException("Map source state is disposed");
    Map<String, Source> next = new HashMap<>();
    for (Source source : sources) {
      if (source.id == null || source.id.isEmpty() || source.data == null || next.put(source.id, source) != null)
        throw new IllegalArgumentException("Invalid or duplicate source ID");
      Double revision = source.revision;
      if (revision != null && (!Double.isFinite(revision) || revision < 0 || revision > 9007199254740991.0 || revision != Math.floor(revision)))
        throw new IllegalArgumentException("Source revision must be a non-negative safe integer");
      Source old = accepted.get(source.id);
      if (old != null && old.revision != null && (revision == null || revision < old.revision || (revision.doubleValue() == old.revision.doubleValue() && !source.data.equals(old.data))))
        throw new IllegalArgumentException("Source " + source.id + " data replacement requires an increased revision");
    }
  }
  public void commit(List<Source> sources) {
    validate(sources);
    Map<String, Source> next = new HashMap<>();
    for (Source source : sources) next.put(source.id, source);
    accepted = next;
  }
  public void close() { closed = true; accepted.clear(); }
}
