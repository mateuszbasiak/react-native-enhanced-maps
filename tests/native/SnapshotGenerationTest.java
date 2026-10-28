import com.enhancedmaps.SnapshotGeneration;
public final class SnapshotGenerationTest {
  static void check(boolean value) { if(!value)throw new AssertionError(); }
  public static void main(String[] args) {
    SnapshotGeneration first=new SnapshotGeneration(), second=new SnapshotGeneration();
    check(!first.isCurrent(0));
    long other=second.begin();
    for(int i=0;i<100;i++) {
      long interrupted=first.begin();
      check(first.isCurrent(interrupted));
      first.invalidate(); // Background, detach, style replacement or disposal.
      check(!first.isCurrent(interrupted));
      check(second.isCurrent(other));
      long next=first.begin();
      check(!first.isCurrent(interrupted));
      check(first.isCurrent(next));
      first.invalidate(); first.invalidate();
      check(!first.isCurrent(next));
    }
  }
}
