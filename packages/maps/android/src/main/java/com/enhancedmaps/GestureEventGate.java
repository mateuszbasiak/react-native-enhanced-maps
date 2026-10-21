package com.enhancedmaps;

import java.util.ArrayList;
import java.util.List;

/** UI-thread gate, four fixed slots, no queues. Only emitted samples allocate. */
public final class GestureEventGate {
  public static final class Sample {
    public final int kind, phase;
    public final long id;
    public final double timestampMs, x, y;
    Sample(int kind, int phase, long id, double time, double x, double y) {
      this.kind=kind; this.phase=phase; this.id=id; this.timestampMs=time; this.x=x; this.y=y;
    }
  }
  private static final class Slot { boolean active; long id; double lastEmission, x, y; }
  private final Slot[] slots = {new Slot(),new Slot(),new Slot(),new Slot()};
  private long sequence;
  public Sample next(int kind, int phase, double time, double x, double y, boolean enabled, double interval) {
    if (!enabled) { reset(); return null; }
    if (kind<0 || kind>=4 || phase<0 || phase>=4 || !Double.isFinite(time) || time<0 || !Double.isFinite(x) || !Double.isFinite(y) || !Double.isFinite(interval) || interval<16 || interval>1000) return null;
    Slot slot=slots[kind];
    if (phase==0) {
      if (slot.active || sequence>=9007199254740991L) return null;
      slot.active=true; slot.id=++sequence;
    } else if (!slot.active) return null;
    slot.x=x; slot.y=y;
    if (phase==1 && time-slot.lastEmission<interval) return null;
    slot.lastEmission=time;
    if (phase==2 || phase==3) slot.active=false;
    return new Sample(kind,phase,slot.id,time,x,y);
  }
  public List<Sample> cancelAll(double time) {
    List<Sample> result=new ArrayList<>(4);
    if (Double.isFinite(time) && time>=0) for(int kind=0;kind<4;kind++) {
      Slot slot=slots[kind];
      if(slot.active) result.add(new Sample(kind,3,slot.id,time,slot.x,slot.y));
    }
    reset();
    return result;
  }
  public void reset() { for(Slot slot:slots) slot.active=false; }
}
