import com.enhancedmaps.CameraOriginTracker;
public class CameraOriginTest {
  static void equal(String expected, String actual) { if(!expected.equals(actual)) throw new AssertionError(actual); }
  public static void main(String[] args) {
    CameraOriginTracker tracker = new CameraOriginTracker();
    long command;
    equal("unknown", tracker.consumeIdle());
    tracker.begin(false, true, false); equal("application", tracker.consumeIdle());
    equal("unknown", tracker.consumeIdle());
    tracker.begin(false, false, true); equal("sdk", tracker.consumeIdle());
    command = tracker.beginApplicationCommand();
    tracker.begin(false, false, true);
    tracker.sdkControlActivated(); // Compass may not deliver another move-start.
    tracker.finishApplicationCommand(command);
    equal("sdk", tracker.consumeIdle());
    command = tracker.beginApplicationCommand();
    tracker.sdkControlActivated();
    long replacement = tracker.beginApplicationCommand();
    tracker.finishApplicationCommand(command);
    tracker.begin(false, false, true); equal("application", tracker.consumeIdle());
    tracker.finishApplicationCommand(replacement);
    tracker.begin(false, true, false); tracker.begin(true, false, false);
    equal("gesture", tracker.consumeIdle());
    tracker.begin(true, true, true); equal("gesture", tracker.consumeIdle());
    tracker.begin(false, true, true); equal("sdk", tracker.consumeIdle());
    tracker.begin(false, false, false); equal("unknown", tracker.consumeIdle());
    tracker.begin(true, false, false); tracker.reset(); equal("unknown", tracker.consumeIdle());
    tracker.begin(true, false, false); equal("unknown", new CameraOriginTracker().consumeIdle());
    command = tracker.beginApplicationCommand();
    tracker.begin(false, false, true);
    equal("application", tracker.consumeIdle());
    tracker.finishApplicationCommand(command);
    tracker.begin(false, false, true); equal("sdk", tracker.consumeIdle());

    // SDK invokes the callback synchronously for a no-op: no ownership may leak.
    command = tracker.beginApplicationCommand();
    tracker.finishApplicationCommand(command);
    tracker.begin(false, false, true); equal("sdk", tracker.consumeIdle());

    long oldCommand = tracker.beginApplicationCommand();
    command = tracker.beginApplicationCommand();
    tracker.finishApplicationCommand(oldCommand);
    tracker.begin(false, false, true); equal("application", tracker.consumeIdle());
    tracker.finishApplicationCommand(command);

    command = tracker.beginApplicationCommand();
    tracker.begin(false, false, true);
    tracker.gestureBegan(); // SDK can suppress a second move-start during interruption.
    tracker.finishApplicationCommand(command);
    equal("gesture", tracker.consumeIdle());
    tracker.begin(false, false, true); equal("sdk", tracker.consumeIdle());
    command = tracker.beginApplicationCommand(); tracker.reset();
    tracker.finishApplicationCommand(command);
    tracker.begin(false, false, true); equal("sdk", tracker.consumeIdle());
  }
}
