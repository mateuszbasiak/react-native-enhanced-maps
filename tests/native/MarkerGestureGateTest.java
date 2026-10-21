import com.enhancedmaps.MarkerGestureGate;
public final class MarkerGestureGateTest {
  static void check(boolean condition) { if(!condition) throw new AssertionError(); }
  public static void main(String[] args) {
    MarkerGestureGate gate = new MarkerGestureGate();
    check(!gate.isReserved());
    check(!gate.claim()); // Delayed responder callbacks after a stream must not lock a map.
    gate.begin(true);
    check(gate.isReserved()); // Marker hit reserves before JS grant.
    check(!gate.claim()); // Already reserved: don't cancel the SDK twice.
    check(gate.isReserved()); // Removing marker/releasing JS does not hand off midstream.
    gate.end();
    check(!gate.isReserved());
    gate.begin(false);
    check(!gate.isReserved()); // Background can pan.
    check(gate.claim()); // Late responder acquisition requires one SDK cancellation.
    check(!gate.claim());
    check(gate.isReserved());
    gate.end(); // UP/CANCEL/detach/dispose use the same reset.
    check(!gate.isReserved());
    check(!gate.claim());
    gate.begin(true);
    gate.begin(false); // Fresh DOWN recovers an interrupted stream.
    check(!gate.isReserved());
    gate.end(); gate.end();
    MarkerGestureGate other = new MarkerGestureGate();
    gate.begin(true);
    check(!other.isReserved());
  }
}
