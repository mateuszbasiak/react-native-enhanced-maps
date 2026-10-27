#import "EMMarkerView.h"
#include <cmath>
#include "MarkerOrder.h"
#import <react/renderer/components/EnhancedMapsSpec/ComponentDescriptors.h>
#import <react/renderer/components/EnhancedMapsSpec/Props.h>
#import <react/renderer/components/EnhancedMapsSpec/EventEmitters.h>
using namespace facebook::react;
@implementation EMMarkerAnnotation {
  UIView *_markerContent;
  UILongPressGestureRecognizer *_markerDragRecognizer;
  BOOL _markerDragEnabled;
  BOOL _markerDragging;
  double _dragSession;
  double _dragRevision;
  double _sessionRevision;
  CLLocationCoordinate2D _controlledCoordinate;
  CGPoint _dragStartPoint;
  CGPoint _dragTouchPoint;
  __weak MLNMapView *_dragMap;
}
- (instancetype)initWithReuseIdentifier:(NSString *)identifier {
  if((self=[super initWithReuseIdentifier:identifier])) {
    _markerDragRecognizer=[[UILongPressGestureRecognizer alloc] initWithTarget:self action:@selector(handleMarkerDrag:)];
    _markerDragRecognizer.minimumPressDuration=.5;
    _markerDragRecognizer.allowableMovement=10;
    _markerDragRecognizer.cancelsTouchesInView=YES;
    _markerDragRecognizer.enabled=NO;
    [self addGestureRecognizer:_markerDragRecognizer];
    [[NSNotificationCenter defaultCenter] addObserver:self selector:@selector(cancelMarkerDrag) name:UIApplicationWillResignActiveNotification object:nil];
  }
  return self;
}
- (BOOL)markerDragging { return _markerDragging; }
- (MLNMapView *)containingMap {
  for(UIView *view=self.superview;view;view=view.superview)if([view isKindOfClass:MLNMapView.class])return (MLNMapView *)view;
  return nil;
}
- (void)configureDrag:(BOOL)enabled revision:(double)revision coordinate:(CLLocationCoordinate2D)coordinate changed:(BOOL)changed {
  _controlledCoordinate=coordinate;
  if(_markerDragging && (!enabled || revision!=_dragRevision)) [self cancelMarkerDrag];
  _markerDragEnabled=enabled;_dragRevision=revision;
  _markerDragRecognizer.enabled=enabled;
  if(changed && !_markerDragging) self.coordinate=coordinate;
}
- (void)cancelMarkerDrag {
  if(!_markerDragging)return;
  _markerDragging=NO;self.coordinate=_controlledCoordinate;
  if(self.dragEvent)self.dragEvent("cancel",_dragSession,_sessionRevision,self.coordinate);
  _dragMap=nil;
  // Reset recognition so a cancelled finger stream cannot restart this drag.
  _markerDragRecognizer.enabled=NO;_markerDragRecognizer.enabled=_markerDragEnabled;
}
- (void)handleMarkerDrag:(UILongPressGestureRecognizer *)recognizer {
  if(recognizer.state==UIGestureRecognizerStateBegan) {
    MLNMapView *map=[self containingMap];
    if(!_markerDragEnabled || !map || !self.window)return;
    _dragMap=map;_markerDragging=YES;_dragSession+=1;_sessionRevision=_dragRevision;
    _dragTouchPoint=[recognizer locationInView:map];
    _dragStartPoint=[map convertCoordinate:self.coordinate toPointToView:map];
    // Cancel already-active map gestures without restoring stale gesture settings.
    for(UIGestureRecognizer *gesture in map.gestureRecognizers)if(gesture.enabled){gesture.enabled=NO;gesture.enabled=YES;}
    if(self.dragEvent)self.dragEvent("start",_dragSession,_sessionRevision,self.coordinate);
  } else if(recognizer.state==UIGestureRecognizerStateChanged || recognizer.state==UIGestureRecognizerStateEnded) {
    MLNMapView *map=_dragMap;
    if(!_markerDragging || !map)return;
    CGPoint touch=[recognizer locationInView:map];
    CLLocationCoordinate2D coordinate=[map convertPoint:CGPointMake(_dragStartPoint.x+touch.x-_dragTouchPoint.x,_dragStartPoint.y+touch.y-_dragTouchPoint.y) toCoordinateFromView:map];
    coordinate.longitude=std::remainder(coordinate.longitude,360.);
    if(!CLLocationCoordinate2DIsValid(coordinate)){[self cancelMarkerDrag];return;}
    self.coordinate=coordinate;
    BOOL ended=recognizer.state==UIGestureRecognizerStateEnded;
    if(ended){_markerDragging=NO;_dragMap=nil;}
    if(self.dragEvent)self.dragEvent(ended?"end":"update",_dragSession,_sessionRevision,coordinate);
  } else if(recognizer.state==UIGestureRecognizerStateCancelled || recognizer.state==UIGestureRecognizerStateFailed) [self cancelMarkerDrag];
}
- (void)didMoveToWindow { [super didMoveToWindow];if(!self.window)[self cancelMarkerDrag]; }
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
  [[NSNotificationCenter defaultCenter] removeObserver:self];
  if (_markerContent) [_markerContent removeObserver:self forKeyPath:@"bounds" context:EMMarkerContentBoundsContext];
}
- (UIView *)hitTest:(CGPoint)p withEvent:(UIEvent *)event { UIView *hit=[super hitTest:p withEvent:event]; return hit==self ? nil : hit; }
- (void)didMoveToSuperview { [super didMoveToSuperview]; [self sortSiblings]; }
- (void)sortSiblings {
  UIView *parent=self.superview; if (!parent) return;
  NSMutableArray<EMMarkerAnnotation *> *markers=[NSMutableArray new];
  for (UIView *v in parent.subviews) if ([v isKindOfClass:EMMarkerAnnotation.class]) [markers addObject:(EMMarkerAnnotation *)v];
  [markers sortUsingComparator:^NSComparisonResult(EMMarkerAnnotation *a,EMMarkerAnnotation *b) {
    return (NSComparisonResult)enhancedmaps::compareMarkerOrder(a.callout,a.markerZIndex,a.mountSequence,b.callout,b.markerZIndex,b.mountSequence);
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
  if((self=[super initWithFrame:frame])) { _props=std::make_shared<const EnhancedMarkerViewProps>(); _annotation=[[EMMarkerAnnotation alloc] initWithReuseIdentifier:nil]; _children=[NSMutableArray new];
    __weak EMMarkerView *weakSelf=self;
    _annotation.dragEvent=^(const char *phase,double session,double revision,CLLocationCoordinate2D coordinate){
      EMMarkerView *owner=weakSelf;if(!owner || !owner->_eventEmitter)return;
      std::static_pointer_cast<const EnhancedMarkerViewEventEmitter>(owner->_eventEmitter)->onMarkerDrag({phase,session,revision,coordinate.latitude,coordinate.longitude});
    };
  }
  return self;
}
- (EMMarkerAnnotation *)annotation { return _annotation; }
- (NSString *)markerIdentifier { const auto &p=*std::static_pointer_cast<const EnhancedMarkerViewProps>(_props);return @(p.markerID.c_str()); }
- (BOOL)callout { return _annotation.callout; }
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
  const auto previous=oldProps ? std::static_pointer_cast<const EnhancedMarkerViewProps>(oldProps) : std::make_shared<const EnhancedMarkerViewProps>();
  const auto &old=*previous;
  [_annotation configureDrag:p.draggable revision:p.dragRevision coordinate:CLLocationCoordinate2DMake(p.latitude,p.longitude) changed:old.latitude!=p.latitude || old.longitude!=p.longitude];
  _annotation.markerZIndex=p.markerZIndex;
  _annotation.callout=p.callout;
  [self updateAnnotationLayout]; [_annotation sortSiblings];
}
@end
Class<RCTComponentViewProtocol> EnhancedMarkerViewCls(void) { return EMMarkerView.class; }
