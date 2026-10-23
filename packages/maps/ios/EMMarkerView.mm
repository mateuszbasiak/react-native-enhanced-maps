#import "EMMarkerView.h"
#import <react/renderer/components/EnhancedMapsSpec/ComponentDescriptors.h>
#import <react/renderer/components/EnhancedMapsSpec/Props.h>
using namespace facebook::react;
@implementation EMMarkerAnnotation {
  UIView *_markerContent;
}
static void *EMMarkerContentBoundsContext = &EMMarkerContentBoundsContext;
// MLNAnnotationView is an accessibility leaf for SDK callouts. Our annotations
// host live React controls, whose labels, actions and screen-space frames must
// remain available to UIKit's accessibility traversal.
- (BOOL)isAccessibilityElement { return NO; }
- (CGRect)accessibilityFrame { return UIAccessibilityConvertFrameToScreenCoordinates(self.bounds, self); }
- (void)setMarkerContent:(UIView *)content {
  if (_markerContent == content) return;
  if (_markerContent) [_markerContent removeObserver:self forKeyPath:@"bounds" context:EMMarkerContentBoundsContext];
  _markerContent = content;
  if (content) [content addObserver:self forKeyPath:@"bounds" options:0 context:EMMarkerContentBoundsContext];
  [self updateContentGeometry];
}
- (void)observeValueForKeyPath:(NSString *)keyPath ofObject:(id)object change:(NSDictionary *)change context:(void *)context {
  if (context == EMMarkerContentBoundsContext) { [self updateContentGeometry]; return; }
  [super observeValueForKeyPath:keyPath ofObject:object change:change context:context];
}
- (void)updateContentGeometry {
  // Fabric's marker shell can stretch to the map width. Only the mounted
  // content defines the annotation's drawable size and geographic anchor.
  CGSize size = _markerContent ? _markerContent.bounds.size : CGSizeZero;
  self.bounds = CGRectMake(0, 0, size.width, size.height);
  self.centerOffset = CGVectorMake((.5-self.anchorX)*size.width+self.offsetX,
                                  (.5-self.anchorY)*size.height+self.offsetY);
}
- (void)dealloc {
  if (_markerContent) [_markerContent removeObserver:self forKeyPath:@"bounds" context:EMMarkerContentBoundsContext];
}
- (UIView *)hitTest:(CGPoint)p withEvent:(UIEvent *)event { UIView *hit=[super hitTest:p withEvent:event]; return hit==self ? nil : hit; }
- (void)didMoveToSuperview { [super didMoveToSuperview]; [self sortSiblings]; }
- (void)sortSiblings {
  UIView *parent=self.superview; if (!parent) return;
  NSMutableArray<EMMarkerAnnotation *> *markers=[NSMutableArray new];
  for (UIView *v in parent.subviews) if ([v isKindOfClass:EMMarkerAnnotation.class]) [markers addObject:(EMMarkerAnnotation *)v];
  [markers sortUsingComparator:^NSComparisonResult(EMMarkerAnnotation *a,EMMarkerAnnotation *b) {
    if(a.markerZIndex!=b.markerZIndex) return a.markerZIndex<b.markerZIndex?NSOrderedAscending:NSOrderedDescending;
    return a.mountSequence==b.mountSequence?NSOrderedSame:(a.mountSequence<b.mountSequence?NSOrderedAscending:NSOrderedDescending);
  }];
  NSUInteger rank=0; for(EMMarkerAnnotation *m in markers) { m.layer.zPosition=rank++; [parent bringSubviewToFront:m]; }
}
@end
@implementation EMMarkerView {
  EMMarkerAnnotation *_annotation;
  NSMutableArray<UIView<RCTComponentViewProtocol> *> *_children;
}
+ (BOOL)shouldBeRecycled { return NO; }
+ (ComponentDescriptorProvider)componentDescriptorProvider { return concreteComponentDescriptorProvider<EnhancedMarkerViewComponentDescriptor>(); }
- (instancetype)initWithFrame:(CGRect)frame {
  if((self=[super initWithFrame:frame])) { _props=std::make_shared<const EnhancedMarkerViewProps>(); _annotation=[[EMMarkerAnnotation alloc] initWithReuseIdentifier:nil]; _children=[NSMutableArray new]; }
  return self;
}
- (EMMarkerAnnotation *)annotation { return _annotation; }
- (UIView *)hitTest:(CGPoint)p withEvent:(UIEvent *)e { UIView *hit=[super hitTest:p withEvent:e]; return hit==self?nil:hit; }
- (void)attachWithSequence:(NSUInteger)sequence { _annotation.mountSequence=sequence; [_annotation sortSiblings]; }
- (void)mountChildComponentView:(UIView<RCTComponentViewProtocol> *)child index:(NSInteger)index { [_children insertObject:child atIndex:index]; [_annotation insertSubview:child atIndex:index]; [_annotation setMarkerContent:_children.firstObject]; [self updateAnnotationLayout]; }
- (void)unmountChildComponentView:(UIView<RCTComponentViewProtocol> *)child index:(NSInteger)index { [_children removeObject:child]; [child removeFromSuperview]; [_annotation setMarkerContent:_children.firstObject]; [self updateAnnotationLayout]; }
- (void)updateLayoutMetrics:(LayoutMetrics const &)layout oldLayoutMetrics:(LayoutMetrics const &)old {
  [super updateLayoutMetrics:layout oldLayoutMetrics:old]; [self updateAnnotationLayout];
}
- (void)updateAnnotationLayout {
  const auto &p=*std::static_pointer_cast<const EnhancedMarkerViewProps>(_props);
  _annotation.anchorX=p.anchorX; _annotation.anchorY=p.anchorY;
  _annotation.offsetX=p.offsetX; _annotation.offsetY=p.offsetY;
  [_annotation updateContentGeometry];
}
- (void)updateProps:(Props::Shared const &)props oldProps:(Props::Shared const &)oldProps {
  [super updateProps:props oldProps:oldProps]; const auto &p=*std::static_pointer_cast<const EnhancedMarkerViewProps>(props);
  _annotation.coordinate=CLLocationCoordinate2DMake(p.latitude,p.longitude); _annotation.markerZIndex=p.markerZIndex;
  [self updateAnnotationLayout]; [_annotation sortSiblings];
}
@end
Class<RCTComponentViewProtocol> EnhancedMarkerViewCls(void) { return EMMarkerView.class; }
