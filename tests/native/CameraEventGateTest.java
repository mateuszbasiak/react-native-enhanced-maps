import com.enhancedmaps.CameraEventGate;
public final class CameraEventGateTest {
  private static void check(boolean value) { if (!value) throw new AssertionError("Camera delivery contract failed"); }
  public static void main(String[] args) {
    CameraEventGate gate = new CameraEventGate();
    check(!gate.finishMovement());
    gate.beginMovement();
    gate.beginMovement();
    check(gate.finishMovement());
    check(!gate.finishMovement());
    check(!gate.shouldEmit(0, false, 100, true));
    check(gate.shouldEmit(0, true, 100, false));
    check(!gate.shouldEmit(99, true, 100, false));
    check(gate.shouldEmit(100, true, 100, false));
    check(gate.shouldEmit(101, true, 100, true));
    check(!gate.shouldEmit(150, true, 100, false));
    gate.reset();
    check(gate.shouldEmit(0, true, 100, false));
    int count = 0;
    gate.reset();
    for (int ms = 0; ms < 1000; ms++) if (gate.shouldEmit(ms, true, 100, false)) count++;
    check(count == 10);
    check(gate.shouldEmit(999, true, 100, true));
  }
}
