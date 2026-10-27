import com.enhancedmaps.MapLifecycleGate;
import java.util.ArrayList;
import java.util.List;

public final class MapLifecycleGateTest {
  static final class Fixture {
    final List<String> events = new ArrayList<>();
    final MapLifecycleGate gate;
    Fixture(boolean active) { gate = new MapLifecycleGate(active, () -> events.add("start"), () -> events.add("resume"), () -> events.add("pause"), () -> events.add("stop")); }
    void expect(String... expected) {
      if (!events.equals(List.of(expected))) throw new AssertionError("Unexpected transitions: " + events);
    }
  }
  public static void main(String[] args) {
    Fixture f = new Fixture(false);
    f.gate.setHostResumed(true);
    f.expect(); // Host resume must not start a detached map.
    f.gate.setAttached(true);
    f.gate.setAttached(true);
    f.gate.setHostResumed(true);
    f.expect("start", "resume");
    f.gate.setAttached(false);
    f.gate.setHostResumed(true);
    f.expect("start", "resume", "pause");
    if (f.gate.isRunning()) throw new AssertionError("Detached map running");
    f.gate.setAttached(true);
    f.gate.setHostResumed(false);
    f.gate.setAttached(false);
    f.gate.setAttached(true); // Navigation while backgrounded must stay paused.
    f.expect("start", "resume", "pause", "resume", "pause", "stop");
    f.gate.setHostResumed(true);
    f.gate.close();
    f.gate.close();
    f.gate.setHostResumed(false);
    f.gate.setHostResumed(true);
    f.gate.setAttached(false);
    f.gate.setAttached(true);
    f.expect("start", "resume", "pause", "resume", "pause", "stop", "start", "resume", "pause", "stop");
    if (f.gate.isRunning()) throw new AssertionError("Disposed map restarted");

    Fixture background = new Fixture(false);
    background.gate.setAttached(true);
    background.expect();
    background.gate.close(); // Interrupted initialization must not stop an unstarted map.
    background.gate.setHostResumed(true);
    background.expect();

    Fixture first = new Fixture(true), second = new Fixture(true);
    for (int i = 0; i < 100; i++) {
      first.gate.setAttached(true);
      second.gate.setAttached(true);
      first.gate.setAttached(false);
      if (!second.gate.isRunning()) throw new AssertionError("Map lifetimes coupled");
      second.gate.setHostResumed(false);
      second.gate.setAttached(false);
      second.gate.setHostResumed(true);
      if (first.gate.isRunning() || second.gate.isRunning()) throw new AssertionError("Detached map running");
    }
    if (first.events.size() != 201 || second.events.size() != 400) throw new AssertionError("Unbalanced cycles");
    first.gate.close(); second.gate.close();
    if (first.events.size() != 202 || second.events.size() != 400) throw new AssertionError("Unbalanced final stop");
  }
}
