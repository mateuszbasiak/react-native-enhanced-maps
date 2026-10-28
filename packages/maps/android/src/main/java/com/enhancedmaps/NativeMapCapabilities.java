package com.enhancedmaps;

/** Integrated host features; implemented layers remain unvalidated until quality gates pass. */
public final class NativeMapCapabilities {
  private NativeMapCapabilities() {}
  public static final String JSON = "{\"engine\":\"maplibre\",\"platform\":\"android\",\"shaders\":\"unvalidated\",\"detailedGestures\":\"unvalidated\",\"layers\":{\"circle\":\"unvalidated\",\"symbol\":\"unsupported\",\"line\":\"unvalidated\",\"fill\":\"unvalidated\",\"raster\":\"unvalidated\",\"heatmap\":\"unvalidated\"}}";
}
