package com.enhancedmaps;
/** Separate overlay role avoids numeric zIndex sentinels competing with app pins. */
public final class MarkerOrder {
  private MarkerOrder() {}
  public static int compare(boolean calloutA,double zA,long sequenceA,boolean calloutB,double zB,long sequenceB) {
    if(calloutA!=calloutB)return calloutA?1:-1;
    if(zA!=zB)return zA<zB?-1:1;
    return Long.compare(sequenceA,sequenceB);
  }
}
