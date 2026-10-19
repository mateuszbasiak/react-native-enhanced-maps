#import "EMRasterOverlay.h"

@implementation EMRasterOverlay
+ (instancetype)fromJSON:(NSString *)source {
  if (source.length > 352000) return nil;
  NSDictionary *json = [NSJSONSerialization JSONObjectWithData:[source dataUsingEncoding:NSUTF8StringEncoding] options:0 error:nil];
  if (![json isKindOfClass:NSDictionary.class]) return nil;
  NSDictionary *b = json[@"bounds"];
  if (![b isKindOfClass:NSDictionary.class] || ![json[@"width"] isKindOfClass:NSNumber.class] || ![json[@"height"] isKindOfClass:NSNumber.class]) return nil;
  for (NSString *key in @[@"north", @"south", @"east", @"west"]) if (![b[key] isKindOfClass:NSNumber.class]) return nil;
  double w = [json[@"width"] doubleValue], h = [json[@"height"] doubleValue];
  double n = [b[@"north"] doubleValue], s = [b[@"south"] doubleValue], e = [b[@"east"] doubleValue], west = [b[@"west"] doubleValue];
  if (!(w >= 1 && w <= 256 && h >= 1 && h <= 256 && floor(w) == w && floor(h) == h && n <= 85 && s >= -85 && n > s && west >= -180 && e <= 180 && e > west && e - west <= 180)) return nil;
  if (![json[@"rgbaBase64"] isKindOfClass:NSString.class]) return nil;
  NSData *rgba = [[NSData alloc] initWithBase64EncodedString:json[@"rgbaBase64"] options:0];
  if (rgba.length != (NSUInteger)(w * h * 4)) return nil;
  CGDataProviderRef provider = CGDataProviderCreateWithCFData((__bridge CFDataRef)rgba);
  CGColorSpaceRef color = CGColorSpaceCreateDeviceRGB();
  CGImageRef image = CGImageCreate(w, h, 8, 32, w * 4, color, kCGBitmapByteOrder32Big | kCGImageAlphaLast, provider, NULL, false, kCGRenderingIntentDefault);
  CGColorSpaceRelease(color); CGDataProviderRelease(provider);
  if (!image) return nil;
  EMRasterOverlay *overlay = [EMRasterOverlay new];
  overlay->_image = [UIImage imageWithCGImage:image]; CGImageRelease(image);
  overlay->_southWest = CLLocationCoordinate2DMake(s, west);
  overlay->_northEast = CLLocationCoordinate2DMake(n, e);
  MKMapPoint nw = MKMapPointForCoordinate(CLLocationCoordinate2DMake(n, west));
  MKMapPoint se = MKMapPointForCoordinate(CLLocationCoordinate2DMake(s, e));
  overlay->_boundingMapRect = MKMapRectMake(nw.x, nw.y, se.x - nw.x, se.y - nw.y);
  overlay->_coordinate = MKCoordinateForMapPoint(MKMapPointMake((nw.x + se.x) / 2, (nw.y + se.y) / 2));
  return overlay;
}
@end

@implementation EMRasterRenderer
- (void)drawMapRect:(MKMapRect)mapRect zoomScale:(MKZoomScale)zoomScale inContext:(CGContextRef)context {
  EMRasterOverlay *raster = (EMRasterOverlay *)self.overlay;
  CGRect rect = [self rectForMapRect:raster.boundingMapRect];
  CGContextSaveGState(context);
  CGContextTranslateCTM(context, rect.origin.x, rect.origin.y + rect.size.height);
  CGContextScaleCTM(context, 1, -1);
  CGContextDrawImage(context, CGRectMake(0, 0, rect.size.width, rect.size.height), raster.image.CGImage);
  CGContextRestoreGState(context);
}
@end
