import com.enhancedmaps.FitLongitude;

public final class FitLongitudeTest {
  private static void equals(double actual, double expected) {
    if (Math.abs(actual - expected) > 1e-9) throw new AssertionError(actual + " != " + expected);
  }
  public static void main(String[] args) {
    double[][] copies = {{180.1,-179.9},{-180.1,179.9},{540.1,-179.9},{-540.1,179.9},{180,180},{-180,-180},{1800000,0},{-1800000,0}};
    for (double[] pair : copies) equals(FitLongitude.coordinate(pair[0], true), pair[1]);
    for (double longitude : new double[]{-180,-1,0,1,180}) equals(FitLongitude.coordinate(longitude, false), longitude);
    for (double longitude : new double[]{180.1,-180.1,540.1,-540.1}) {
      try { FitLongitude.coordinate(longitude, false); throw new AssertionError("Explicit longitude accepted"); }
      catch (IllegalArgumentException expected) {}
    }
    for (boolean scene : new boolean[]{false,true}) for (double longitude : new double[]{Double.NaN,Double.POSITIVE_INFINITY,Double.NEGATIVE_INFINITY}) {
      try { FitLongitude.coordinate(longitude, scene); throw new AssertionError("Nonfinite longitude accepted"); }
      catch (IllegalArgumentException expected) {}
    }
  }
}
