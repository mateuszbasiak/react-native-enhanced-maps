import com.enhancedmaps.MarkerOrder;
public final class MarkerOrderTest {
  static void check(boolean condition){if(!condition)throw new AssertionError();}
  public static void main(String[] args){
    check(MarkerOrder.compare(false,1000,8,true,-1000,1)<0);
    check(MarkerOrder.compare(true,-Double.MAX_VALUE,1,false,Double.MAX_VALUE,9)>0);
    check(MarkerOrder.compare(false,2,1,false,1,9)>0);
    check(MarkerOrder.compare(false,2,1,false,2,9)<0);
    check(MarkerOrder.compare(true,0,2,true,0,2)==0);
  }
}
