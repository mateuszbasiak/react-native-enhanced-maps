package com.enhancedmaps;

public final class FitLongitude {
  private FitLongitude() {}
  public static double coordinate(double longitude, boolean acceptedGeometry) {
    if (!Double.isFinite(longitude) || (!acceptedGeometry && Math.abs(longitude)>180)) throw new IllegalArgumentException("Invalid fit coordinate");
    // Accepted generated shapes use continuous world copies across the dateline.
    // Keep the explicit fit-coordinate contract strict at the call site.
    if (longitude>180 || longitude<-180) {
      longitude %= 360;
      if (longitude>180) longitude-=360;
      if (longitude<-180) longitude+=360;
    }
    return longitude;
  }
}
