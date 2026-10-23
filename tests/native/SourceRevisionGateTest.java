import com.enhancedmaps.SourceRevisionGate;
import com.enhancedmaps.SourceRevisionGate.Source;
import java.util.Arrays;
import java.util.Collections;

public final class SourceRevisionGateTest {
  static Source s(String id, Double revision, String data) { return new Source(id, revision, data); }
  static void reject(Runnable action) { try { action.run(); } catch (IllegalArgumentException | IllegalStateException expected) { return; } throw new AssertionError("Expected rejection"); }
  public static void main(String[] args) {
    SourceRevisionGate gate = new SourceRevisionGate();
    gate.commit(Arrays.asList(s("a", 2.0, "A"), s("b", 1.0, "B")));
    gate.validate(Arrays.asList(s("a", 2.0, "A"), s("b", 1.0, "B")));
    reject(() -> gate.validate(Arrays.asList(s("a", 1.0, "old"))));
    reject(() -> gate.validate(Arrays.asList(s("a", 2.0, "changed"))));
    reject(() -> gate.validate(Arrays.asList(s("a", null, "A"))));
    reject(() -> gate.commit(Arrays.asList(s("a", 3.0, "new"), s("b", 0.0, "old"))));
    // The rejected batch must not advance a; validation alone must not advance it either.
    gate.validate(Arrays.asList(s("a", 3.0, "new"), s("b", 1.0, "B")));
    gate.commit(Arrays.asList(s("a", 2.0, "A"), s("b", 1.0, "B")));
    gate.commit(Arrays.asList(s("a", 3.0, "new")));
    reject(() -> gate.validate(Arrays.asList(s("a", 2.0, "A"))));
    gate.commit(Collections.emptyList());
    gate.commit(Arrays.asList(s("a", 0.0, "restart")));
    SourceRevisionGate other = new SourceRevisionGate();
    other.commit(Arrays.asList(s("a", null, "first")));
    other.commit(Arrays.asList(s("a", null, "second")));
    other.commit(Arrays.asList(s("a", 0.0, "opt-in")));
    reject(() -> other.validate(Arrays.asList(s("a", -0.0, "changed"))));
    for (double invalid : new double[] {-1, .5, Double.NaN, Double.POSITIVE_INFINITY, 9007199254740992.0})
      reject(() -> other.validate(Arrays.asList(s("invalid", invalid, "data"))));
    other.validate(Arrays.asList(s("max", 9007199254740991.0, "data")));
    reject(() -> other.validate(Arrays.asList(s("duplicate", 0.0, "A"), s("duplicate", 0.0, "A"))));
    gate.close(); gate.close();
    reject(() -> gate.validate(Collections.emptyList()));
    reject(() -> gate.commit(Arrays.asList(s("a", 10.0, "late"))));
  }
}
