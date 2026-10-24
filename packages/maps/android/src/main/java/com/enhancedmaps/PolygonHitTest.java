package com.enhancedmaps;

/** Geometry check for SDK fill hits; line/marker hit testing stays with the SDK. */
public final class PolygonHitTest {
  private PolygonHitTest() {}
  private static double y(double latitude) {
    double clamped=Math.max(-85.0511287798066,Math.min(85.0511287798066,latitude));
    return Math.log(Math.tan(Math.PI/4+Math.toRadians(clamped)/2));
  }
  private static boolean valid(double[][] ring) {
    if(ring==null || ring.length<4)return false;
    for(double[] p:ring)if(p==null || p.length!=2 || !Double.isFinite(p[0]) || !Double.isFinite(p[1]) || Math.abs(p[1])>90)return false;
    return ring[0][0]==ring[ring.length-1][0] && ring[0][1]==ring[ring.length-1][1];
  }
  private static boolean ringContains(double longitude,double latitude,double[][] ring) {
    double west=Double.POSITIVE_INFINITY,east=Double.NEGATIVE_INFINITY;
    for(double[] p:ring){west=Math.min(west,p[0]);east=Math.max(east,p[0]);}
    double min=Math.ceil((west-longitude)/360),max=Math.floor((east-longitude)/360);
    // Accepted scenes are bounded; avoid unbounded work on malformed SDK geometry.
    if(!Double.isFinite(min) || !Double.isFinite(max) || max-min>4096)return false;
    int copies=(int)Math.max(0,max-min+1);
    double py=y(latitude);
    for(int world=0;world<copies;world++) {
      double px=longitude+360*(min+world);
      boolean inside=false;
      for(int i=1;i<ring.length;i++) {
        double ax=ring[i-1][0],ay=y(ring[i-1][1]),bx=ring[i][0],by=y(ring[i][1]);
        double cross=(px-ax)*(by-ay)-(py-ay)*(bx-ax);
        if(Math.abs(cross)<1e-10 && px>=Math.min(ax,bx)-1e-10 && px<=Math.max(ax,bx)+1e-10 && py>=Math.min(ay,by)-1e-10 && py<=Math.max(ay,by)+1e-10)return true;
        if((ay>py)!=(by>py) && px<ax+(py-ay)*(bx-ax)/(by-ay))inside=!inside;
      }
      if(inside)return true;
    }
    return false;
  }
  public static boolean contains(double longitude,double latitude,double[][][] rings) {
    if(!Double.isFinite(longitude) || !Double.isFinite(latitude) || Math.abs(latitude)>90 || rings==null || rings.length==0)return false;
    for(double[][] ring:rings)if(!valid(ring))return false;
    if(!ringContains(longitude,latitude,rings[0]))return false;
    for(int i=1;i<rings.length;i++)if(ringContains(longitude,latitude,rings[i]))return false;
    return true;
  }
}
