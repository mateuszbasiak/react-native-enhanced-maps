#import <MapKit/MapKit.h>

@interface EMRasterOverlay : NSObject <MKOverlay>
@property(nonatomic, readonly) CLLocationCoordinate2D coordinate;
@property(nonatomic, readonly) MKMapRect boundingMapRect;
@property(nonatomic, readonly) UIImage *image;
@property(nonatomic, readonly) CLLocationCoordinate2D southWest;
@property(nonatomic, readonly) CLLocationCoordinate2D northEast;
+ (instancetype)fromJSON:(NSString *)source;
@end

@interface EMRasterRenderer : MKOverlayRenderer
@end
