package com.enhancedmaps;

import java.net.URI;

/** Android asset:// treats the authority as the first asset-directory component. */
public final class OverlayImagePath {
  public static String asset(String value) {
    URI uri=URI.create(value);
    if(!"asset".equals(uri.getScheme()))throw new IllegalArgumentException("Invalid Overlay asset URL");
    String path=(uri.getAuthority()==null?"":uri.getAuthority())+(uri.getPath()==null?"":uri.getPath());
    int start=0;while(start<path.length() && path.charAt(start)=='/')++start;
    if(start==path.length())throw new IllegalArgumentException("Invalid Overlay asset path");
    return path.substring(start);
  }
}
