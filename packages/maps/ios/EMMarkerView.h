#import <React/RCTViewComponentView.h>
#import <MapLibre/MapLibre.h>
@interface EMMarkerAnnotation : MLNAnnotationView <MLNAnnotation>
@property(nonatomic) CLLocationCoordinate2D coordinate;
@property(nonatomic,readonly) BOOL markerDragging;
@property(nonatomic,copy) void (^dragEvent)(const char *phase,double session,double revision,CLLocationCoordinate2D coordinate);
- (void)configureDrag:(BOOL)enabled revision:(double)revision coordinate:(CLLocationCoordinate2D)coordinate changed:(BOOL)changed;
- (void)cancelMarkerDrag;
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
@property(nonatomic,readonly) NSString *markerIdentifier;
- (void)attachWithSequence:(NSUInteger)sequence;
@end
