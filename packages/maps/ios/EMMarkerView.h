#import <React/RCTViewComponentView.h>
#import <MapLibre/MapLibre.h>
@interface EMMarkerAnnotation : MLNAnnotationView <MLNAnnotation>
@property(nonatomic) CLLocationCoordinate2D coordinate;
@property(nonatomic) double markerZIndex;
@property(nonatomic) NSUInteger mountSequence;
@property(nonatomic) double anchorX;
@property(nonatomic) double anchorY;
@property(nonatomic) double offsetX;
@property(nonatomic) double offsetY;
- (void)setMarkerContent:(UIView *)content;
- (void)updateContentGeometry;
- (void)sortSiblings;
@end
@interface EMMarkerView : RCTViewComponentView
@property(nonatomic,readonly) EMMarkerAnnotation *annotation;
- (void)attachWithSequence:(NSUInteger)sequence;
@end
