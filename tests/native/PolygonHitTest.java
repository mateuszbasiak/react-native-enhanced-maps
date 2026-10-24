import java.util.Arrays;
public final class PolygonHitTest {
  static double[][] ring(double west, double south, double east, double north) {
    return new double[][] {{west,south},{east,south},{east,north},{west,north},{west,south}};
  }
  static boolean hit(double x,double y,double[][]... rings) { return com.enhancedmaps.PolygonHitTest.contains(x,y,rings); }
  static void check(boolean condition,String label) { if(!condition)throw new AssertionError(label); }
  public static void main(String[] args) {
    double[][] outer=ring(-5,-5,5,5), hole=ring(-1,-1,1,1);
    check(hit(3,0,outer,hole),"filled area");
    check(!hit(0,0,outer,hole),"hole interior");
    check(!hit(9,0,outer,hole),"outside exterior");
    check(hit(5,0,outer,hole),"exterior boundary");
    check(!hit(1,0,outer,hole),"hole boundary is excluded from fill");
    java.util.Collections.reverse(Arrays.asList(outer)); java.util.Collections.reverse(Arrays.asList(hole));
    check(hit(3,0,outer,hole) && !hit(0,0,outer,hole),"winding independence");
    check(!hit(2.5,2.5,outer,hole,ring(2,2,3,3)),"second hole");
    double[][] dateline=ring(170,-10,190,10), datelineHole=ring(178,-2,182,2);
    check(!hit(-179,0,dateline,datelineHole),"wrapped hole");
    check(hit(-175,0,dateline,datelineHole),"wrapped fill");
    check(hit(175,0,dateline,datelineHole),"unwrapped fill");
    check(!hit(0,0,dateline,datelineHole),"other world outside");
    double[][] wide=ring(-170,-10,170,10);
    check(!hit(160,0,wide,ring(159,-1,161,1)),"wide exterior hole");
    check(hit(145,0,wide,ring(159,-1,161,1)),"wide exterior fill");
    check(!hit(179,0,wide),"wide exterior must not become a short dateline polygon");
    check(!hit(Double.NaN,0,outer),"invalid query");
    check(!hit(0,0,new double[][] {{0,0},{1,1}}),"invalid ring");
    check(!hit(0,0,new double[][] {{0,0},{1,0},{Double.NaN,1},{0,0}}),"invalid vertex");
    check(!hit(0,0),"empty polygon");
  }
}
