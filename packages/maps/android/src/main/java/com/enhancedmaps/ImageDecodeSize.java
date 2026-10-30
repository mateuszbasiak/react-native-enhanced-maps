package com.enhancedmaps;

/** BitmapFactory samples by powers of two. The bound comes from the live renderer. */
public final class ImageDecodeSize {
  public static int sample(int width,int height,int textureDimension) {
    if(width<=0 || height<=0 || textureDimension<=0)throw new IllegalArgumentException("Invalid Overlay image dimensions or renderer capability");
    int sample=1;
    while(((long)Math.max(width,height)+sample-1)/sample>textureDimension) sample=next(sample);
    return sample;
  }
  public static int next(int sample) {
    if(sample<=0 || sample>Integer.MAX_VALUE/2)throw new IllegalArgumentException("Overlay image cannot be decoded");
    return sample*2;
  }
}
