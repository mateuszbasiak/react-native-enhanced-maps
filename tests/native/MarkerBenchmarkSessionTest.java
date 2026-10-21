import com.enhancedmaps.MarkerBenchmarkSession;
public final class MarkerBenchmarkSessionTest {
  private static void check(boolean value) { if (!value) throw new AssertionError("Benchmark cancellation failed"); }
  public static void main(String[] args) {
    MarkerBenchmarkSession session = new MarkerBenchmarkSession();
    int setup = session.begin(false);
    check(!session.isAnimating());
    check(!session.cancelGesture()); // A manual pan must not invalidate marker setup.
    check(session.isCurrent(setup));
    int run = session.begin(true);
    check(!session.isCurrent(setup));
    check(session.cancelGesture());
    check(!session.isCurrent(run)); // Delayed camera steps must never restart after a pan.
    check(!session.isAnimating());
    check(!session.cancelGesture());
    int next = session.begin(true);
    session.cancel();
    check(!session.isCurrent(next));
    int completed = session.begin(true);
    session.finish(completed);
    check(!session.isAnimating());
  }
}
