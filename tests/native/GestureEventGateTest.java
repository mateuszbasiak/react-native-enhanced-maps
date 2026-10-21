import com.enhancedmaps.GestureEventGate;
import com.enhancedmaps.GestureEventGate.Sample;
import java.util.List;
public class GestureEventGateTest {
  static void check(boolean value) { if (!value) throw new AssertionError(); }
  static Sample next(GestureEventGate gate, int kind, int phase, double time, double x) { return gate.next(kind, phase, time, x, x + 1, true, 50); }
  public static void main(String[] args) {
    GestureEventGate gate = new GestureEventGate();
    check(next(gate, 0, 1, 0, 1)==null); // Update/end require a begin.
    check(next(gate, 0, 2, 0, 1)==null);
    check(gate.next(0,0,0,1,2,false,50)==null);
    Sample begin=next(gate,0,0,10,1);
    check(begin!=null && begin.id==1 && begin.phase==0);
    check(next(gate,0,0,11,2)==null);
    check(next(gate,0,1,59,3)==null);
    Sample update=next(gate,0,1,60,4);
    check(update!=null && update.id==begin.id && update.phase==1);
    Sample end=next(gate,0,2,61,5);
    check(end!=null && end.id==begin.id && end.phase==2 && end.x==5);
    check(next(gate,0,3,62,6)==null); // Terminal emitted exactly once.
    Sample a=next(gate,0,0,100,1), b=next(gate,1,0,100,2);
    check(a.id!=b.id);
    check(next(gate,0,1,110,9)==null); // Even dropped updates refresh cancellation position.
    List<Sample> cancelled=gate.cancelAll(111);
    check(cancelled.size()==2 && cancelled.get(0).id==a.id && cancelled.get(0).x==9 && cancelled.get(0).phase==3);
    check(gate.cancelAll(112).isEmpty());
    Sample resumed=next(gate,0,0,120,1);
    check(resumed.id>b.id);
    gate.reset(); check(next(gate,0,2,121,1)==null);
    next(gate,2,0,130,1);
    gate.next(2,1,131,1,2,false,50);
    check(next(gate,2,1,200,1)==null);
    for(int kind:new int[]{-1,4}) check(next(gate,kind,0,200,1)==null);
    for(int phase:new int[]{-1,4}) check(next(gate,0,phase,200,1)==null);
    for(double invalid:new double[]{-1,Double.NaN,Double.POSITIVE_INFINITY}) check(next(gate,0,0,invalid,1)==null);
    check(next(gate,0,0,200,Double.NaN)==null);
    check(gate.next(0,0,200,1,2,true,15)==null);
    check(gate.next(0,0,200,1,2,true,1001)==null);
    check(gate.next(0,0,200,1,2,true,Double.NaN)==null);
    check(next(new GestureEventGate(),0,0,200,1).id==1);
  }
}
