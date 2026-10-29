import com.enhancedmaps.CoalescedTask;
import java.util.ArrayList;
import java.util.List;

public final class CoalescedTaskTest {
  static void check(boolean value, String message) { if (!value) throw new AssertionError(message); }
  static final class Fixture {
    final List<Runnable> queue = new ArrayList<>();
    final List<Integer> observations = new ArrayList<>();
    int state;
    final CoalescedTask task = new CoalescedTask(r -> { queue.add(r); return true; }, queue::remove, () -> observations.add(state));
    void drain() { queue.remove(0).run(); }
  }
  public static void main(String[] args) {
    Fixture first = new Fixture(), second = new Fixture();
    for (int i=0; i<1000; i++) { first.state=i; first.task.request(); }
    check(first.queue.size()==1, "Frame burst queued more than one task");
    first.drain();
    check(first.observations.equals(List.of(999)), "Task used stale state");
    first.task.request();
    Runnable obsolete=first.queue.get(0);
    first.task.cancel();
    check(first.queue.isEmpty(), "Cancelled task retained by queue");
    second.task.request();
    first.task.request();
    obsolete.run(); // A removed callback can already have been delivered.
    check(first.queue.size()==1 && first.observations.size()==1, "Obsolete callback consumed replacement");
    first.drain();
    check(second.queue.size()==1, "Different maps share task state");
    second.drain();
    for(int i=0;i<100;i++) { first.task.request(); first.task.cancel(); first.task.request(); first.drain(); }
    check(first.queue.isEmpty() && first.observations.size()==102, "Unbalanced lifetime cycles");
    first.task.request(); Runnable disposed=first.queue.get(0);
    first.task.close(); first.task.close(); first.task.request(); disposed.run();
    check(first.queue.isEmpty() && first.observations.size()==102, "Disposed task restarted");

    int[] attempts={0}; List<Runnable> posted=new ArrayList<>();
    CoalescedTask rejected=new CoalescedTask(r -> { attempts[0]++; return false; }, posted::remove, () -> {});
    rejected.request(); rejected.request();
    check(attempts[0]==2, "Failed enqueue wedged scheduler");
    CoalescedTask throwing=new CoalescedTask(r -> { throw new IllegalStateException("queue closed"); }, posted::remove, () -> {});
    for(int i=0;i<2;i++) { try { throwing.request(); throw new AssertionError("Missing queue failure"); } catch(IllegalStateException expected) {} }

    CoalescedTask[] reentrant=new CoalescedTask[1]; int[] runs={0};
    reentrant[0]=new CoalescedTask(r -> { posted.add(r); return true; }, posted::remove, () -> { if(++runs[0]==1)reentrant[0].request(); });
    reentrant[0].request(); posted.remove(0).run();
    check(posted.size()==1, "Work could not request subsequent update");
    posted.remove(0).run(); check(runs[0]==2 && posted.isEmpty(), "Reentrant update lost");
  }
}
