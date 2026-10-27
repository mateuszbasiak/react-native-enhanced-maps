#import "EMMapLibreView.h"
#import "EMMarkerView.h"
#import "SourceRevisionGate.h"
#import "NativeMapCapabilities.h"
#import "CameraOrigin.h"
#import "NativeCameraFit.h"
#import "GestureEventGate.h"
#import "NativeClustering.h"
#import "NativeClusterQueries.h"
#import "MarkerClusterLayout.h"
#import "PolygonHitTest.h"
#import "LineGradient.h"
#include <cmath>
#import <MapLibre/MapLibre.h>
#import "EMShaderPrototype.h"
#import "EMShaderLayer.h"
#import <react/renderer/components/EnhancedMapsSpec/ComponentDescriptors.h>
#import <react/renderer/components/EnhancedMapsSpec/EventEmitters.h>
#import <react/renderer/components/EnhancedMapsSpec/Props.h>
#import <react/renderer/components/EnhancedMapsSpec/RCTComponentViewHelpers.h>
using namespace facebook::react;
// UIKit resolves pointerEvents before assigning touch.view. Ignore only touches
// actually targeting package marker descendants or SDK controls.
static BOOL EMIsOverlayTouch(UITouch *touch) {
  for(UIView *view=touch.view; view; view=view.superview)
    if([view isKindOfClass:EMMarkerAnnotation.class] || [view isKindOfClass:UIControl.class] || [view isKindOfClass:MLNCompassButton.class])return YES;
  return NO;
}
static enhancedmaps::HitPolygon EMHitPolygon(MLNPolygon *polygon) {
  enhancedmaps::HitPolygon rings;
  NSMutableArray<MLNPolygon *> *parts=[NSMutableArray arrayWithObject:polygon];
  [parts addObjectsFromArray:polygon.interiorPolygons?:@[]];
  for(MLNPolygon *part in parts) {
    enhancedmaps::HitRing ring;
    ring.reserve(part.pointCount);
    for(NSUInteger i=0;i<part.pointCount;i++)ring.push_back({part.coordinates[i].longitude,part.coordinates[i].latitude});
    rings.push_back(std::move(ring));
  }
  return rings;
}
static BOOL EMAcceptsFillHit(id<MLNFeature> feature,CLLocationCoordinate2D coordinate) {
  id shape=feature;
  if([shape isKindOfClass:MLNPolygon.class]) {
    MLNPolygon *polygon=shape;
    return !polygon.interiorPolygons.count || enhancedmaps::containsFilledPolygon(coordinate.longitude,coordinate.latitude,EMHitPolygon(polygon));
  }
  if([shape isKindOfClass:MLNMultiPolygon.class]) {
    NSArray<MLNPolygon *> *polygons=((MLNMultiPolygon *)shape).polygons;
    BOOL hasHoles=NO;
    for(MLNPolygon *polygon in polygons)if(polygon.interiorPolygons.count){hasHoles=YES;break;}
    if(!hasHoles)return YES;
    for(MLNPolygon *polygon in polygons)if(enhancedmaps::containsFilledPolygon(coordinate.longitude,coordinate.latitude,EMHitPolygon(polygon)))return YES;
    return NO;
  }
  return YES;
}
@interface MLNMapView (EMGestureSuperclass)
- (BOOL)gestureRecognizerShouldBegin:(UIGestureRecognizer *)recognizer;
@end
@interface EMNativeMap : MLNMapView <UIGestureRecognizerDelegate>
@property(nonatomic,copy) void (^sdkCameraOperation)(void);
@end
@implementation EMNativeMap
- (IBAction)resetNorth {
  if(self.sdkCameraOperation)self.sdkCameraOperation();
  [super resetNorth];
  if(self.sdkCameraOperation)self.sdkCameraOperation();
}
- (IBAction)resetPosition {
  if(self.sdkCameraOperation)self.sdkCameraOperation();
  [super resetPosition];
  if(self.sdkCameraOperation)self.sdkCameraOperation();
}
- (BOOL)gestureRecognizer:(UIGestureRecognizer *)recognizer shouldReceiveTouch:(UITouch *)touch { return !EMIsOverlayTouch(touch); }
- (BOOL)gestureRecognizerShouldBegin:(UIGestureRecognizer *)r { return [super gestureRecognizerShouldBegin:r]; }
@end
@interface EMMapLibreView () <MLNMapViewDelegate,RCTEnhancedMapLibreViewViewProtocol,UIGestureRecognizerDelegate>
@end
static int EMGestureKind(UIGestureRecognizer *recognizer) {
  if([recognizer isKindOfClass:UIPanGestureRecognizer.class])return ((UIPanGestureRecognizer *)recognizer).minimumNumberOfTouches==2?3:0;
  if([recognizer isKindOfClass:UIPinchGestureRecognizer.class])return 1;
  if([recognizer isKindOfClass:UIRotationGestureRecognizer.class])return 2;
  if([recognizer isKindOfClass:UILongPressGestureRecognizer.class]) {
    UILongPressGestureRecognizer *press=(UILongPressGestureRecognizer *)recognizer;
    if(press.minimumPressDuration==0 && press.numberOfTapsRequired==1)return 1;
  }
  return -1;
}
@implementation EMMapLibreView {
  EMNativeMap *_map;
  NSString *_lastPaddingError;
#if DEBUG && MLN_RENDER_BACKEND_METAL
  EMShaderPrototype *_shaderPrototype;
#endif
#if MLN_RENDER_BACKEND_METAL
  NSMutableDictionary<NSString *,EMWebGPUTextureLayer *> *_shaderLayers;
#endif
  NSMutableArray<EMMarkerView *> *_markers;
  NSMutableArray<NSString *> *_sourceIDs;
  NSMutableArray<NSString *> *_layerIDs;
  NSDictionary<NSString *,NSString *> *_layerSources;
  NSMutableSet<NSString *> *_interactiveLayers;
  NSUInteger _sequence;
  BOOL _configured;
  BOOL _ready;
  double _loadingStyleRevision;
  double _readyStyleRevision;
  enhancedmaps::SourceRevisionGate _sourceRevisions;
  uint64_t _clusterIndexRevision;
  NSSet<NSString *> *_clusteredSources;
  NSString *_acceptedSceneJSON;
  NSArray<NSDictionary *> *_markerLayoutSources;
  NSDictionary *_lastMarkerLayout;
  enhancedmaps::GestureEventGate _gestureEvents;
  enhancedmaps::CameraOperationOrigin _cameraOrigins;
  BOOL _fitPreflight;
  NSArray<UIGestureRecognizer *> *_observedGestures;
}
+ (BOOL)shouldBeRecycled { return NO; }
+ (ComponentDescriptorProvider)componentDescriptorProvider { return concreteComponentDescriptorProvider<EnhancedMapLibreViewComponentDescriptor>(); }
- (instancetype)initWithFrame:(CGRect)frame { if((self=[super initWithFrame:frame])) { _props=std::make_shared<const EnhancedMapLibreViewProps>(); _markers=[NSMutableArray new]; _sourceIDs=[NSMutableArray new]; _layerIDs=[NSMutableArray new]; }return self; }
- (void)didMoveToWindow { [super didMoveToWindow]; if(!self.window)[self cancelNativeGestures]; [self configure]; }
- (void)configure {
  if(_configured || !self.window)return; _configured=YES;
  const auto &p=*std::static_pointer_cast<const EnhancedMapLibreViewProps>(_props);
  NSURL *url=p.styleURL.empty()?nil:[NSURL URLWithString:@(p.styleURL.c_str())];
  _loadingStyleRevision=p.styleRevision;
  _map=[[EMNativeMap alloc] initWithFrame:self.bounds styleURL:url]; _map.delegate=self; self.contentView=_map;
  _map.automaticallyAdjustsContentInset=NO;
  __weak EMMapLibreView *weakSelf=self;
  [self applyMapSettings];
  _map.sdkCameraOperation=^{ EMMapLibreView *owner=weakSelf; if(owner)owner->_cameraOrigins.sdkBegan(); };
  _observedGestures=[_map.gestureRecognizers copy];
  for(UIGestureRecognizer *recognizer in _observedGestures) {
    // Some SDK quick-zoom/tap recognizers have no delegate. Include them in
    // initial-touch marker filtering without replacing existing SDK delegates.
    if(!recognizer.delegate)recognizer.delegate=_map;
    if(EMGestureKind(recognizer)>=0)[recognizer addTarget:self action:@selector(observeNativeGesture:)];
  }
  [[NSNotificationCenter defaultCenter] addObserver:self selector:@selector(onApplicationResignActive:) name:UIApplicationWillResignActiveNotification object:nil];
  UITapGestureRecognizer *tap=[[UITapGestureRecognizer alloc] initWithTarget:self action:@selector(featureTap:)]; tap.cancelsTouchesInView=NO; tap.delaysTouchesBegan=NO; tap.delaysTouchesEnded=NO; tap.delegate=self; [_map addGestureRecognizer:tap];
  // UIKit's tap can otherwise complete after a stationary long hold. This
  // exclusion recognizer observes only; it never consumes React child touches.
  UILongPressGestureRecognizer *hold=[[UILongPressGestureRecognizer alloc] initWithTarget:self action:@selector(mapLongPress:)];
  hold.minimumPressDuration=.5; hold.cancelsTouchesInView=NO; hold.delegate=self;
  [_map addGestureRecognizer:hold]; [tap requireGestureRecognizerToFail:hold];
  // A feature press is a confirmed single tap. Let the SDK's one-finger
  // double-tap zoom win before querying features, as Android already does.
  for(UIGestureRecognizer *recognizer in _observedGestures) {
    if([recognizer isKindOfClass:UITapGestureRecognizer.class]) {
      UITapGestureRecognizer *sdkTap=(UITapGestureRecognizer *)recognizer;
      if(sdkTap.numberOfTouchesRequired==1 && sdkTap.numberOfTapsRequired>1)
        [tap requireGestureRecognizerToFail:sdkTap];
    }
    if([recognizer isKindOfClass:UILongPressGestureRecognizer.class]) {
      UILongPressGestureRecognizer *quickZoom=(UILongPressGestureRecognizer *)recognizer;
      if(quickZoom.numberOfTapsRequired==1 && quickZoom.minimumPressDuration==0)
        [tap requireGestureRecognizerToFail:quickZoom];
    }
  }
  for(EMMarkerView *marker in _markers)[_map addAnnotation:marker.annotation];
  [self animateCamera:p.initialLatitude longitude:p.initialLongitude zoom:p.initialZoom heading:p.initialHeading pitch:p.initialPitch durationMs:0];
}
- (void)layoutSubviews { [super layoutSubviews];[self applyMapPadding]; }
- (void)applyMapPadding {
  if(!_map || _map.bounds.size.width<=0 || _map.bounds.size.height<=0)return;
  const auto &p=*std::static_pointer_cast<const EnhancedMapLibreViewProps>(_props);
  UIEdgeInsets desired=UIEdgeInsetsMake(p.mapPaddingTop,p.mapPaddingLeft,p.mapPaddingBottom,p.mapPaddingRight);
  BOOL valid=YES;for(double edge:{p.mapPaddingTop,p.mapPaddingLeft,p.mapPaddingBottom,p.mapPaddingRight})if(!std::isfinite(edge) || edge<0 || edge>100000)valid=NO;
  BOOL fits=valid && desired.left+desired.right<_map.bounds.size.width && desired.top+desired.bottom<_map.bounds.size.height;
  NSString *errorKey=fits?nil:[NSString stringWithFormat:@"%@/%g/%g",NSStringFromUIEdgeInsets(desired),_map.bounds.size.width,_map.bounds.size.height];
  if(errorKey && ![errorKey isEqual:_lastPaddingError])[self emitError:@"Map padding leaves no valid viewport; using zero padding" code:@"invalid-map-padding"];
  _lastPaddingError=errorKey;
  if(!fits)desired=UIEdgeInsetsZero;
  if(UIEdgeInsetsEqualToEdgeInsets(desired,_map.contentInset))return;
  _cameraOrigins.applicationCallBegan();
  @try { _map.contentInset=desired; } @finally { _cameraOrigins.applicationCallEnded(); }
}
- (void)applyMapSettings {
  if(!_map)return;
  const auto &p=*std::static_pointer_cast<const EnhancedMapLibreViewProps>(_props);
  if(!std::isfinite(p.minZoomLevel) || !std::isfinite(p.maxZoomLevel) || p.minZoomLevel<0 || p.maxZoomLevel>24 || p.minZoomLevel>p.maxZoomLevel) {
    [self emitError:@"Map zoom limits must be ordered within [0,24]"];return;
  }
  if(_map.scrollEnabled!=p.scrollEnabled)_map.scrollEnabled=p.scrollEnabled;
  if(_map.zoomEnabled!=p.zoomEnabled)_map.zoomEnabled=p.zoomEnabled;
  if(_map.rotateEnabled!=p.rotateEnabled)_map.rotateEnabled=p.rotateEnabled;
  if(_map.pitchEnabled!=p.pitchEnabled)_map.pitchEnabled=p.pitchEnabled;
  if(_map.showsCompassView!=p.showsCompass)_map.showsCompassView=p.showsCompass;
  if(_map.minimumZoomLevel!=p.minZoomLevel || _map.maximumZoomLevel!=p.maxZoomLevel) {
    // Widen first so disjoint interval replacements remain valid at every setter.
    _map.minimumZoomLevel=0;_map.maximumZoomLevel=24;
    _map.minimumZoomLevel=p.minZoomLevel;_map.maximumZoomLevel=p.maxZoomLevel;
  }
  [self applyMapPadding];
}
- (void)updateProps:(Props::Shared const &)props oldProps:(Props::Shared const &)oldProps {
  const auto &old=*std::static_pointer_cast<const EnhancedMapLibreViewProps>(_props); const auto &next=*std::static_pointer_cast<const EnhancedMapLibreViewProps>(props);
  BOOL styleChanged=old.styleURL!=next.styleURL || old.styleRevision!=next.styleRevision; BOOL sceneChanged=old.sceneJSON!=next.sceneJSON;
  if(old.gestureEventsEnabled!=next.gestureEventsEnabled || old.gestureSubscriptionRevision!=next.gestureSubscriptionRevision)_gestureEvents.reset();
  [super updateProps:props oldProps:oldProps]; [self configure]; [self applyMapSettings];
  if(styleChanged && _map) {
#if DEBUG && MLN_RENDER_BACKEND_METAL
    [_shaderPrototype stop];_shaderPrototype=nil;
#endif
#if MLN_RENDER_BACKEND_METAL
    [_shaderLayers removeAllObjects];
#endif
    _ready=NO; _loadingStyleRevision=next.styleRevision;
    _map.styleURL=next.styleURL.empty()?nil:[NSURL URLWithString:@(next.styleURL.c_str())];
  }
  else if(sceneChanged && _ready)[self applyScene];
}
- (void)updateEventEmitter:(EventEmitter::Shared const &)emitter { [super updateEventEmitter:emitter]; if(_ready && _eventEmitter)std::static_pointer_cast<const EnhancedMapLibreViewEventEmitter>(_eventEmitter)->onMapReady({true, enhancedmaps::nativeMapCapabilitiesJSON(), _readyStyleRevision}); }
- (void)mountChildComponentView:(UIView<RCTComponentViewProtocol> *)child index:(NSInteger)index {
  if([child isKindOfClass:EMMarkerView.class]) { EMMarkerView *marker=(EMMarkerView *)child; [_markers insertObject:marker atIndex:MIN(index,_markers.count)]; [marker attachWithSequence:++_sequence]; [self addSubview:marker]; if(_map)[_map addAnnotation:marker.annotation]; }
  else [super mountChildComponentView:child index:index];
}
- (void)unmountChildComponentView:(UIView<RCTComponentViewProtocol> *)child index:(NSInteger)index {
  if([child isKindOfClass:EMMarkerView.class]) { EMMarkerView *marker=(EMMarkerView *)child; [_map removeAnnotation:marker.annotation]; [_markers removeObject:marker]; [marker removeFromSuperview]; }
  else [super unmountChildComponentView:child index:index];
}
- (MLNAnnotationView *)mapView:(MLNMapView *)map viewForAnnotation:(id<MLNAnnotation>)annotation { return [annotation isKindOfClass:EMMarkerAnnotation.class]?(EMMarkerAnnotation *)annotation:nil; }
- (void)mapView:(MLNMapView *)map didSelectAnnotationView:(MLNAnnotationView *)view { if([view isKindOfClass:EMMarkerAnnotation.class])[(EMMarkerAnnotation *)view sortSiblings]; }
- (void)mapView:(MLNMapView *)map didFinishLoadingStyle:(MLNStyle *)style {
  if(map!=_map || style!=_map.style)return;
  _lastMarkerLayout=nil;
  [_layerIDs removeAllObjects]; [_sourceIDs removeAllObjects]; _ready=YES; _readyStyleRevision=_loadingStyleRevision;
  if(![self applyScene] && _acceptedSceneJSON)[self applySceneJSON:_acceptedSceneJSON];
  if(_eventEmitter)std::static_pointer_cast<const EnhancedMapLibreViewEventEmitter>(_eventEmitter)->onMapReady({true, enhancedmaps::nativeMapCapabilitiesJSON(), _readyStyleRevision});
}
- (void)mapViewDidFinishRenderingFrame:(MLNMapView *)map fullyRendered:(BOOL)fullyRendered {
  if(!fullyRendered || map!=_map || !_ready || !_eventEmitter || !self.window)return;
  const auto &p=*std::static_pointer_cast<const EnhancedMapLibreViewProps>(_props);
  if(p.styleRevision!=_readyStyleRevision)return;
  @try {
    CGFloat markerExtent=0;
    for(EMMarkerView *marker in _markers) {
      EMMarkerAnnotation *view=marker.annotation;
      CGSize size=view.bounds.size;
      markerExtent=MAX(markerExtent,MAX(size.width*MAX(view.anchorX,1-view.anchorX)+fabs(view.offsetX),size.height*MAX(view.anchorY,1-view.anchorY)+fabs(view.offsetY)));
    }
    NSDictionary *layout=EMMarkerClusterLayout(map,_markerLayoutSources,_clusterIndexRevision,markerExtent);
    if(!layout || [layout isEqual:_lastMarkerLayout])return;
    NSString *json=EMMarkerClusterLayoutJSON(layout);
    _lastMarkerLayout=layout;
    std::static_pointer_cast<const EnhancedMapLibreViewEventEmitter>(_eventEmitter)->onMarkerClusters({std::string(json.UTF8String),_readyStyleRevision});
  } @catch(NSException *exception) {
    std::static_pointer_cast<const EnhancedMapLibreViewEventEmitter>(_eventEmitter)->onMapError({"marker-cluster",std::string(exception.reason.UTF8String ?: "Marker cluster layout failed")});
  }
}
- (void)emitGesture:(const enhancedmaps::GestureSample &)sample {
  const auto &p=*std::static_pointer_cast<const EnhancedMapLibreViewProps>(_props);
  if(!p.gestureEventsEnabled || !_eventEmitter)return;
  static const char *kinds[]={"pan","zoom","rotate","tilt"};
  static const char *phases[]={"begin","update","end","cancel"};
  EnhancedMapLibreViewEventEmitter::OnGesture event;
  event.kind=kinds[sample.kind];event.phase=phases[sample.phase];event.id=sample.id;
  event.timestampMs=sample.timestampMs;event.x=sample.x;event.y=sample.y;
  event.subscriptionRevision=p.gestureSubscriptionRevision;
  std::static_pointer_cast<const EnhancedMapLibreViewEventEmitter>(_eventEmitter)->onGesture(event);
}
- (void)observeNativeGesture:(UIGestureRecognizer *)recognizer {
  int kind=EMGestureKind(recognizer),phase=-1;
  switch(recognizer.state) {
    case UIGestureRecognizerStateBegan:phase=0;break;
    case UIGestureRecognizerStateChanged:phase=1;break;
    case UIGestureRecognizerStateEnded:phase=2;break;
    case UIGestureRecognizerStateCancelled:
    case UIGestureRecognizerStateFailed:phase=3;break;
    default:return;
  }
  if(phase==0)_cameraOrigins.gestureBegan();
  const auto &p=*std::static_pointer_cast<const EnhancedMapLibreViewProps>(_props);
  CGPoint point=[recognizer locationInView:_map];
  auto sample=_gestureEvents.next(kind,phase,CACurrentMediaTime()*1000,point.x,point.y,p.gestureEventsEnabled && _eventEmitter!=nullptr && self.window!=nil,p.gestureEventIntervalMs);
  if(sample)[self emitGesture:*sample];
}
- (void)cancelNativeGestures {
  for(const auto &sample:_gestureEvents.cancelAll(CACurrentMediaTime()*1000))[self emitGesture:sample];
}
- (void)onApplicationResignActive:(NSNotification *)notification { [self cancelNativeGestures]; }
- (void)emitError:(NSString *)message { [self emitError:message code:@"maplibre"]; }
- (void)emitError:(NSString *)message code:(NSString *)code { if(_eventEmitter)std::static_pointer_cast<const EnhancedMapLibreViewEventEmitter>(_eventEmitter)->onMapError({std::string(code.UTF8String),std::string(message.UTF8String ?: "Map error")}); }
- (void)mapViewDidFailLoadingMap:(MLNMapView *)map withError:(NSError *)error { [self emitError:error.localizedDescription]; }
- (void)emitRegionEvent:(MLNMapView *)map gesture:(BOOL)gesture complete:(BOOL)complete {
  const auto &p=*std::static_pointer_cast<const EnhancedMapLibreViewProps>(_props);
  if(!p.regionEventsEnabled || !_ready || !_eventEmitter || _fitPreflight)return;
  MLNCoordinateBounds bounds=map.visibleCoordinateBounds;
  double west=bounds.sw.longitude,east=bounds.ne.longitude;
  double delta=east>=west?east-west:east+360-west;
  double longitude=std::remainder(west+delta/2,360.);
  std::static_pointer_cast<const EnhancedMapLibreViewEventEmitter>(_eventEmitter)->onRegionEvent({(bounds.sw.latitude+bounds.ne.latitude)/2,longitude,bounds.ne.latitude-bounds.sw.latitude,std::min(360.,delta),(bool)gesture,(bool)complete,_readyStyleRevision});
}
- (void)mapView:(MLNMapView *)map regionIsChangingWithReason:(MLNCameraChangeReason)reason {
  const MLNCameraChangeReason gestures=MLNCameraChangeReasonGesturePan|MLNCameraChangeReasonGesturePinch|MLNCameraChangeReasonGestureRotate|MLNCameraChangeReasonGestureZoomIn|MLNCameraChangeReasonGestureZoomOut|MLNCameraChangeReasonGestureOneFingerZoom|MLNCameraChangeReasonGestureTilt;
  [self emitRegionEvent:map gesture:(reason&gestures)!=0 complete:NO];
}
- (void)mapView:(MLNMapView *)map regionDidChangeWithReason:(MLNCameraChangeReason)reason animated:(BOOL)animated {
  if(_fitPreflight)return;
  const MLNCameraChangeReason gestures=MLNCameraChangeReasonGesturePan|MLNCameraChangeReasonGesturePinch|MLNCameraChangeReasonGestureRotate|MLNCameraChangeReasonGestureZoomIn|MLNCameraChangeReasonGestureZoomOut|MLNCameraChangeReasonGestureOneFingerZoom|MLNCameraChangeReasonGestureTilt;
  [self emitRegionEvent:map gesture:(reason&gestures)!=0 complete:YES];
  const char *origin=_cameraOrigins.resolve((reason&gestures)!=0,(reason&MLNCameraChangeReasonProgrammatic)!=0,(reason&MLNCameraChangeReasonResetNorth)!=0);
  if(_eventEmitter)std::static_pointer_cast<const EnhancedMapLibreViewEventEmitter>(_eventEmitter)->onCameraIdle({map.centerCoordinate.latitude,map.centerCoordinate.longitude,map.zoomLevel,map.direction,map.camera.pitch,origin});
  for(EMMarkerView *m in _markers)[m.annotation sortSiblings];
}
- (void)handleCommand:(const NSString *)name args:(const NSArray *)args { RCTEnhancedMapLibreViewHandleCommand(self,name,args); }
- (void)animateCamera:(double)latitude longitude:(double)longitude zoom:(double)zoom heading:(double)heading pitch:(double)pitch durationMs:(double)durationMs {
  if(!_map)return; MLNMapCamera *camera=[_map.camera copy]; camera.centerCoordinate=CLLocationCoordinate2DMake(latitude,longitude); camera.pitch=pitch; camera.heading=heading;
  camera.altitude=MLNAltitudeForZoomLevel(zoom,pitch,latitude,_map.bounds.size);
  [self submitCamera:camera durationMs:durationMs];
}
- (void)submitCamera:(MLNMapCamera *)camera durationMs:(double)durationMs {
  [self submitCamera:camera durationMs:durationMs edgePadding:UIEdgeInsetsZero];
}
- (void)submitCamera:(MLNMapCamera *)camera durationMs:(double)durationMs edgePadding:(UIEdgeInsets)padding {
  UIEdgeInsets content=_map.contentInset;
  UIEdgeInsets target=UIEdgeInsetsMake(padding.top+content.top,padding.left+content.left,padding.bottom+content.bottom,padding.right+content.right);
  if([_map.camera isEqualToMapCamera:camera] && UIEdgeInsetsEqualToEdgeInsets(_map.cameraEdgeInsets,target))return;
  _cameraOrigins.applicationCallBegan();
  @try {
    [_map setCamera:camera withDuration:MAX(0,durationMs)/1000 animationTimingFunction:[CAMediaTimingFunction functionWithName:kCAMediaTimingFunctionEaseInEaseOut] edgePadding:padding completionHandler:nil];
  } @finally {
    // Immediate camera updates can finish synchronously with a canceled compass's
    // reason bits. The explicit call owns these callbacks and the new movement.
    _cameraOrigins.applicationCallEnded();
  }
}
static UIColor *EMColor(id value) {
  if(![value isKindOfClass:NSString.class])return UIColor.blackColor;
  NSString *hex=[value stringByReplacingOccurrencesOfString:@"#" withString:@""]; unsigned int n=0;
  if(hex.length==3)hex=[NSString stringWithFormat:@"%C%C%C%C%C%C",[hex characterAtIndex:0],[hex characterAtIndex:0],[hex characterAtIndex:1],[hex characterAtIndex:1],[hex characterAtIndex:2],[hex characterAtIndex:2]];
  if((hex.length==6 || hex.length==8) && [[NSScanner scannerWithString:hex] scanHexInt:&n]) { if(hex.length==8)return [UIColor colorWithRed:((n>>24)&255)/255. green:((n>>16)&255)/255. blue:((n>>8)&255)/255. alpha:(n&255)/255.];return [UIColor colorWithRed:((n>>16)&255)/255. green:((n>>8)&255)/255. blue:(n&255)/255. alpha:1]; }
  NSDictionary *names=@{@"red":UIColor.redColor,@"black":UIColor.blackColor,@"white":UIColor.whiteColor,@"blue":UIColor.blueColor,@"transparent":UIColor.clearColor}; return names[value]?:UIColor.blackColor;
}
- (void)emitSceneError:(NSString *)message {
  if(_eventEmitter)std::static_pointer_cast<const EnhancedMapLibreViewEventEmitter>(_eventEmitter)->onMapError({"layer-scene",std::string(message.UTF8String ?: "Invalid scene")});
}
- (BOOL)applyScene {
  const auto &p=*std::static_pointer_cast<const EnhancedMapLibreViewProps>(_props);
  return [self applySceneJSON:p.sceneJSON.empty()?@"{\"sources\":[],\"layers\":[]}":@(p.sceneJSON.c_str())];
}
- (BOOL)applySceneJSON:(NSString *)json {
  if(!_ready || !_map.style)return NO;
  if([json lengthOfBytesUsingEncoding:NSUTF8StringEncoding]>4*1024*1024) { [self emitSceneError:@"Scene exceeds 4 MiB UTF-8 byte limit"];return NO; }
  NSError *error=nil;
  NSDictionary *scene=[NSJSONSerialization JSONObjectWithData:[json dataUsingEncoding:NSUTF8StringEncoding] options:0 error:&error];
  if(error || ![scene isKindOfClass:NSDictionary.class] || ![scene[@"sources"] isKindOfClass:NSArray.class] || ![scene[@"layers"] isKindOfClass:NSArray.class]) { [self emitSceneError:@"Invalid scene JSON"];return NO; }
  MLNStyle *style=_map.style;
  std::vector<enhancedmaps::RevisionedSource> revisions;
  NSMutableArray<MLNShapeSource *> *parsedSources=[NSMutableArray new];
  NSMutableSet<NSString *> *metricSources=[NSMutableSet new];
  NSMutableDictionary<NSString *,NSExpression *> *gradients=[NSMutableDictionary new];
  @try {
    // Validate all source versions and parse geometry before removing the accepted scene.
    for(NSDictionary *entry in scene[@"sources"]) {
      id rawRevision=entry[@"revision"];
      if(rawRevision && (![rawRevision isKindOfClass:NSNumber.class] || CFGetTypeID((__bridge CFTypeRef)rawRevision)==CFBooleanGetTypeID())) { [self emitSceneError:@"Source revision must be a number"];return NO; }
      NSData *data=[NSJSONSerialization dataWithJSONObject:entry[@"data"] options:NSJSONWritingSortedKeys error:&error];
      if(error || !data) { [self emitSceneError:error.localizedDescription?:@"Invalid GeoJSON"];return NO; }
      NSString *identifier=entry[@"id"];
      if(![identifier isKindOfClass:NSString.class]) { [self emitSceneError:@"Invalid source ID"];return NO; }
      NSDictionary *options=EMClusterOptions(entry);
      std::string identity((const char *)data.bytes,data.length);
      if([entry[@"lineMetrics"] boolValue]) { identity+="\nlineMetrics:true";[metricSources addObject:identifier]; }
      if(entry[@"cluster"]) {
        NSData *configuration=[NSJSONSerialization dataWithJSONObject:entry[@"cluster"] options:NSJSONWritingSortedKeys error:&error];
        if(!configuration)@throw [NSException exceptionWithName:@"Cluster" reason:@"Invalid cluster options" userInfo:nil];
        identity+="\n";identity.append((const char *)configuration.bytes,configuration.length);
      }
      revisions.push_back({std::string(identifier.UTF8String),rawRevision?std::optional<double>([rawRevision doubleValue]):std::nullopt,identity});
      MLNShape *shape=[MLNShape shapeWithData:data encoding:NSUTF8StringEncoding error:&error];
      if(error || !shape) { [self emitSceneError:error.localizedDescription?:@"Invalid GeoJSON"];return NO; }
      if(entry[@"cluster"])EMStampClusterShape(shape,_clusterIndexRevision+1);
      [parsedSources addObject:[[MLNShapeSource alloc] initWithIdentifier:identifier shape:shape options:options]];
    }
    for(NSDictionary *entry in scene[@"layers"])if(entry[@"clusterFilter"] && ![@[@"clusters",@"points"] containsObject:entry[@"clusterFilter"]])@throw [NSException exceptionWithName:@"Cluster" reason:@"Invalid cluster filter" userInfo:nil];
    for(NSDictionary *entry in scene[@"layers"]) { NSExpression *gradient=EMLineGradientExpression(entry,metricSources);if(gradient)gradients[entry[@"id"]]=gradient; }
    try { _sourceRevisions.validate(revisions); }
    catch(const std::exception &exception) { [self emitSceneError:@(exception.what())];return NO; }
    EMClusterQueryRequire(_clusterIndexRevision<9007199254740991ULL,@"Cluster index revisions exhausted");
    ++_clusterIndexRevision;
    for(NSString *identifier in [_layerIDs reverseObjectEnumerator]) { MLNStyleLayer *layer=[style layerWithIdentifier:identifier]; if(layer)[style removeLayer:layer]; }
    for(NSString *identifier in _sourceIDs) { MLNSource *source=[style sourceWithIdentifier:identifier]; if(source)[style removeSource:source]; }
    [_layerIDs removeAllObjects]; [_sourceIDs removeAllObjects]; NSMutableDictionary *sources=[NSMutableDictionary new]; _interactiveLayers=[NSMutableSet new];
    for(MLNShapeSource *source in parsedSources) { [style addSource:source]; [_sourceIDs addObject:source.identifier]; }
    for(NSDictionary *entry in scene[@"layers"]) {
      MLNSource *source=[style sourceWithIdentifier:entry[@"source"]]; if(!source){[self emitSceneError:@"Layer source does not exist"];return NO;}
      MLNStyleLayer *layer=nil; NSString *type=entry[@"type"]; NSDictionary *s=entry[@"style"]?:@{};
      if([type isEqual:@"circle"]) { MLNCircleStyleLayer *l=[[MLNCircleStyleLayer alloc] initWithIdentifier:entry[@"id"] source:source]; if(s[@"circleColor"])l.circleColor=[NSExpression expressionForConstantValue:EMColor(s[@"circleColor"])]; if(s[@"circleRadius"])l.circleRadius=[NSExpression expressionForConstantValue:s[@"circleRadius"]]; if(s[@"circleOpacity"])l.circleOpacity=[NSExpression expressionForConstantValue:s[@"circleOpacity"]]; layer=l; }
      else if([type isEqual:@"line"]) { MLNLineStyleLayer *l=[[MLNLineStyleLayer alloc] initWithIdentifier:entry[@"id"] source:source]; if(gradients[entry[@"id"]])l.lineGradient=gradients[entry[@"id"]]; if(s[@"lineColor"])l.lineColor=[NSExpression expressionForConstantValue:EMColor(s[@"lineColor"])]; if(s[@"lineWidth"])l.lineWidth=[NSExpression expressionForConstantValue:s[@"lineWidth"]]; if(s[@"lineOpacity"])l.lineOpacity=[NSExpression expressionForConstantValue:s[@"lineOpacity"]]; if(s[@"lineCap"])l.lineCap=[NSExpression expressionForConstantValue:s[@"lineCap"]]; if(s[@"lineJoin"])l.lineJoin=[NSExpression expressionForConstantValue:s[@"lineJoin"]]; if(s[@"lineMiterLimit"])l.lineMiterLimit=[NSExpression expressionForConstantValue:s[@"lineMiterLimit"]]; if(s[@"lineDasharray"])l.lineDashPattern=[NSExpression expressionForConstantValue:s[@"lineDasharray"]]; layer=l; }
      else if([type isEqual:@"fill"]) { MLNFillStyleLayer *l=[[MLNFillStyleLayer alloc] initWithIdentifier:entry[@"id"] source:source]; if(s[@"fillColor"])l.fillColor=[NSExpression expressionForConstantValue:EMColor(s[@"fillColor"])]; if(s[@"fillOpacity"])l.fillOpacity=[NSExpression expressionForConstantValue:s[@"fillOpacity"]]; layer=l; }
      if(!layer)continue;
      if(entry[@"clusterFilter"] && [layer isKindOfClass:MLNVectorStyleLayer.class])((MLNVectorStyleLayer *)layer).predicate=[entry[@"clusterFilter"] isEqual:@"clusters"]?[NSPredicate predicateWithFormat:@"cluster == YES"]:[NSPredicate predicateWithFormat:@"cluster != YES"];
      if([entry[@"interactive"] boolValue])[_interactiveLayers addObject:layer.identifier]; layer.visible=entry[@"visible"]?[entry[@"visible"] boolValue]:YES;
      MLNStyleLayer *before=entry[@"beforeId"]?[style layerWithIdentifier:entry[@"beforeId"]]:nil; if(before)[style insertLayer:layer belowLayer:before];else [style addLayer:layer]; [_layerIDs addObject:layer.identifier]; sources[layer.identifier]=entry[@"source"];
    } _layerSources=sources;
    _sourceRevisions.commit(revisions);
    NSMutableSet *clustered=[NSMutableSet new];
    for(NSDictionary *entry in scene[@"sources"])if(entry[@"cluster"])[clustered addObject:entry[@"id"]];
    _clusteredSources=[clustered copy];
    // Retain only layout metadata; frame callbacks never decode the GeoJSON scene.
    NSMutableArray<NSDictionary *> *markerLayoutSources=[NSMutableArray new];
    for(NSDictionary *entry in scene[@"sources"]) {
      NSString *identifier=entry[@"id"];
      if([identifier isEqual:@"em-marker-clusters"] || [identifier hasPrefix:@"em-marker-clusters:"]) {
        NSMutableDictionary *metadata=[@{@"id":identifier} mutableCopy];
        if(entry[@"revision"])metadata[@"revision"]=entry[@"revision"];
        [markerLayoutSources addObject:[metadata copy]];
      }
    }
    _markerLayoutSources=[markerLayoutSources copy];
    _acceptedSceneJSON=[json copy];
    return YES;
  } @catch(NSException *exception) { [self emitSceneError:exception.reason?:@"Could not apply scene"];return NO; }
}
- (BOOL)gestureRecognizer:(UIGestureRecognizer *)recognizer shouldReceiveTouch:(UITouch *)touch { return !EMIsOverlayTouch(touch); }
- (BOOL)gestureRecognizer:(UIGestureRecognizer *)a shouldRecognizeSimultaneouslyWithGestureRecognizer:(UIGestureRecognizer *)b { return YES; }
- (void)featureTap:(UITapGestureRecognizer *)tap {
  if(tap.state!=UIGestureRecognizerStateEnded || !_eventEmitter)return;
  CGPoint point=[tap locationInView:_map];
  CLLocationCoordinate2D coordinate=[_map convertPoint:point toCoordinateFromView:_map];
  for(MLNStyleLayer *styleLayer in [_map.style.layers reverseObjectEnumerator]) {
    NSString *layer=styleLayer.identifier;
    if(![_interactiveLayers containsObject:layer])continue;
    id<MLNFeature> feature=nil;
    for(id<MLNFeature> candidate in [_map visibleFeaturesAtPoint:point inStyleLayersWithIdentifiers:[NSSet setWithObject:layer]]) {
      if(![styleLayer isKindOfClass:MLNFillStyleLayer.class] || EMAcceptsFillHit(candidate,coordinate)){feature=candidate;break;}
    }
    if(!feature)continue;
    NSString *identifier=[feature.identifier description]?:@"";
    NSMutableDictionary *properties=[feature.attributes mutableCopy]?:[NSMutableDictionary new];
    double featureIndexRevision=(double)_clusterIndexRevision;
    if([_clusteredSources containsObject:_layerSources[layer]]) {
      id stamp=properties[EMClusterIndexProperty];featureIndexRevision=[stamp isKindOfClass:NSNumber.class]?[stamp doubleValue]:0;
      [properties removeObjectForKey:EMClusterIndexProperty];
    }
    if([feature conformsToProtocol:@protocol(MLNCluster)]) {
      id<MLNCluster> cluster=(id<MLNCluster>)feature;
      identifier=[NSString stringWithFormat:@"cluster:%lu",(unsigned long)cluster.clusterIdentifier];
      properties[@"cluster"]=@YES;properties[@"cluster_id"]=@(cluster.clusterIdentifier);properties[@"point_count"]=@(cluster.clusterPointCount);
    } else featureIndexRevision=0;
    NSData *propertiesData=[NSJSONSerialization dataWithJSONObject:properties options:0 error:nil];
    if(!propertiesData)continue;
    NSString *propertiesJSON=[[NSString alloc] initWithData:propertiesData encoding:NSUTF8StringEncoding];
    std::static_pointer_cast<const EnhancedMapLibreViewEventEmitter>(_eventEmitter)->onFeaturePress({
      std::string([_layerSources[layer] UTF8String]?:""), std::string(identifier.UTF8String), std::string(layer.UTF8String), std::string(propertiesJSON.UTF8String), featureIndexRevision, _readyStyleRevision,
      coordinate.latitude, coordinate.longitude, point.x, point.y
    });
    return;
  }
  [self emitMapPress:"tap" point:point];
}
- (void)mapLongPress:(UILongPressGestureRecognizer *)recognizer {
  if(recognizer.state==UIGestureRecognizerStateBegan)
    [self emitMapPress:"long-press" point:[recognizer locationInView:_map]];
}
- (void)queryMap:(double)requestId requestJSON:(NSString *)requestJSON {
  if(!_eventEmitter)return;
  const auto &p=*std::static_pointer_cast<const EnhancedMapLibreViewProps>(_props);
  double revision=p.styleRevision;
  NSString *result=@"", *failure=@"";
  @try {
    if(!std::isfinite(requestId) || requestId<1 || std::floor(requestId)!=requestId || [requestJSON lengthOfBytesUsingEncoding:NSUTF8StringEncoding]>65536)
      @throw [NSException exceptionWithName:@"MapQuery" reason:@"Invalid map query" userInfo:nil];
    NSDictionary *request=[NSJSONSerialization JSONObjectWithData:[requestJSON dataUsingEncoding:NSUTF8StringEncoding] options:0 error:nil];
    if(![request isKindOfClass:NSDictionary.class])@throw [NSException exceptionWithName:@"MapQuery" reason:@"Invalid map query" userInfo:nil];
    auto number=[&](NSString *key)->double {
      id value=request[key];
      if(![value isKindOfClass:NSNumber.class] || !std::isfinite([value doubleValue]))@throw [NSException exceptionWithName:@"MapQuery" reason:@"Invalid map query number" userInfo:nil];
      return [value doubleValue];
    };
    revision=number(@"styleRevision");
    if(!_ready || !_map || !self.window || revision!=_readyStyleRevision || revision!=p.styleRevision)
      @throw [NSException exceptionWithName:@"MapQuery" reason:@"Map is not ready" userInfo:nil];
    NSDictionary *response=nil;
#if MLN_RENDER_BACKEND_METAL
    if([request[@"kind"] isEqual:@"shaderLayer"]) {
      NSString *identifier=request[@"id"],*poolID=request[@"poolId"],*action=request[@"action"];
      NSRegularExpression *pattern=[NSRegularExpression regularExpressionWithPattern:@"^[a-zA-Z0-9_.:-]{1,128}$" options:0 error:nil];
      if(![identifier isKindOfClass:NSString.class] || [pattern numberOfMatchesInString:identifier options:0 range:NSMakeRange(0,identifier.length)]!=1)
        @throw [NSException exceptionWithName:@"ShaderLayer" reason:@"Invalid layer id" userInfo:nil];
      if(!_shaderLayers)_shaderLayers=[NSMutableDictionary new];
      EMWebGPUTextureLayer *existing=_shaderLayers[identifier];
      EMWebGPUOutputPool *pool=EMWebGPUPool(poolID);
      if([action isEqual:@"remove"]) {
        if(existing && existing.pool==pool) { if([_map.style layerWithIdentifier:identifier]==existing)[_map.style removeLayer:existing];[_shaderLayers removeObjectForKey:identifier]; }
      } else if([action isEqual:@"redraw"]) {
        if(!existing || !pool || existing.pool!=pool)@throw [NSException exceptionWithName:@"ShaderLayer" reason:@"Shader layer owner mismatch" userInfo:nil];
        [existing setNeedsDisplay];
      } else if([action isEqual:@"attach"]) {
        if(!pool || (existing && existing.pool!=pool) || ([_map.style layerWithIdentifier:identifier] && [_map.style layerWithIdentifier:identifier]!=existing))
          @throw [NSException exceptionWithName:@"ShaderLayer" reason:@"Unknown pool or duplicate layer id" userInfo:nil];
        MLNStyleLayer *before=nil;
        if(request[@"beforeId"]) {
          if(![request[@"beforeId"] isKindOfClass:NSString.class] || [request[@"beforeId"] isEqual:identifier] || !(before=[_map.style layerWithIdentifier:request[@"beforeId"]]))
            @throw [NSException exceptionWithName:@"ShaderLayer" reason:@"beforeId layer is missing" userInfo:nil];
        } else if(![request[@"placement"] isEqual:@"above-labels"])for(MLNStyleLayer *layer in _map.style.layers)if([layer isKindOfClass:MLNSymbolStyleLayer.class]) { before=layer;break; }
        EMWebGPUTextureLayer *layer=[[EMWebGPUTextureLayer alloc] initWithIdentifier:identifier];
        layer.pool=pool;
        __weak EMWebGPUTextureLayer *weakLayer=layer;
        {std::lock_guard<std::mutex> lock(pool->state->mutex);pool->state->repaint=[weakLayer]{dispatch_async(dispatch_get_main_queue(),^{[weakLayer setNeedsDisplay];});};}
        if(existing && [_map.style layerWithIdentifier:identifier]==existing)[_map.style removeLayer:existing];
        if(before)[_map.style insertLayer:layer belowLayer:before];else [_map.style addLayer:layer];
        _shaderLayers[identifier]=layer;
      } else @throw [NSException exceptionWithName:@"ShaderLayer" reason:@"Invalid shader action" userInfo:nil];
      response=@{@"accepted":@YES};
    } else
#endif
#if DEBUG && MLN_RENDER_BACKEND_METAL
    // Internal Debug-only feasibility command; deliberately absent from MapViewRef.
    if([request[@"kind"] isEqual:@"shaderPrototype"]) {
      NSString *action=request[@"action"];
      if([action isEqual:@"stats"]) {
        response=@{@"frames":@(_shaderPrototype.frames),@"maxAnchorError":@(_shaderPrototype.maxAnchorError),@"failure":_shaderPrototype.failure ?: @"",@"installed":@(_shaderPrototype!=nil)};
      } else {
        if(![@[@"below",@"above",@"pause",@"resume",@"remove",@"configure"] containsObject:action])
          @throw [NSException exceptionWithName:@"ShaderPrototype" reason:@"Invalid prototype action" userInfo:nil];
        if([action isEqual:@"pause"] || [action isEqual:@"resume"]) {
          _shaderPrototype.paused=[action isEqual:@"pause"];
        } else if(![action isEqual:@"configure"]) {
          [_shaderPrototype stop];
          if(_shaderPrototype && [_map.style layerWithIdentifier:_shaderPrototype.identifier])[_map.style removeLayer:_shaderPrototype];
          _shaderPrototype=nil;
          if(![action isEqual:@"remove"]) {
            MLNStyleLayer *before=nil;
            if([action isEqual:@"below"]) {
              for(MLNStyleLayer *layer in _map.style.layers)
                if([layer isKindOfClass:MLNSymbolStyleLayer.class]) { before=layer;break; }
              if(!before)@throw [NSException exceptionWithName:@"ShaderPrototype" reason:@"Style has no symbol layer" userInfo:nil];
            }
            _shaderPrototype=[[EMShaderPrototype alloc] initWithIdentifier:@"em-debug-shader"];
            if(before)[_map.style insertLayer:_shaderPrototype belowLayer:before];
            else [_map.style addLayer:_shaderPrototype];
          }
        }
        if(![action isEqual:@"remove"]) {
          if(request[@"uniforms"])[_shaderPrototype configure:request[@"uniforms"]];
          if(request[@"effectSource"])[_shaderPrototype setEffectSource:request[@"effectSource"]];
        }
        response=@{@"accepted":@YES,@"action":action};
      }
    } else
#endif
    if([@[@"clusterChildren",@"clusterLeaves",@"clusterExpansion"] containsObject:request[@"kind"]]) {
      response=EMClusterQuery(_map,request,_clusterIndexRevision,_clusteredSources);
    } else if([request[@"kind"] isEqual:@"fit"]) {
      double duration=number(@"durationMs");EMFitRequire(duration>=0 && duration<=60000,@"Invalid fit duration");
      NSMutableArray *markers=[NSMutableArray new];for(EMMarkerView *marker in _markers) { CLLocationCoordinate2D c=marker.annotation.coordinate;[markers addObject:@[@(c.latitude),@(c.longitude)]]; }
      MLNCoordinateBounds bounds=EMFitBounds(_map,request,_acceptedSceneJSON,markers);
      CLLocationCoordinate2D corners[]={bounds.sw,CLLocationCoordinate2DMake(bounds.ne.latitude,bounds.sw.longitude),bounds.ne,CLLocationCoordinate2DMake(bounds.sw.latitude,bounds.ne.longitude)};
      UIEdgeInsets padding=UIEdgeInsetsMake(number(@"top"),number(@"left"),number(@"bottom"),number(@"right"));
      MLNMapCamera *initial=[_map.camera copy];UIEdgeInsets oldInsets=_map.cameraEdgeInsets,content=_map.contentInset;
      UIEdgeInsets effectivePadding=UIEdgeInsetsMake(padding.top+content.top,padding.left+content.left,padding.bottom+content.bottom,padding.right+content.right);
      UIEdgeInsets oldPadding=UIEdgeInsetsMake(oldInsets.top-content.top,oldInsets.left-content.left,oldInsets.bottom-content.bottom,oldInsets.right-content.right);
      _cameraOrigins.applicationCallBegan();
      _fitPreflight=YES;
      @try {
        MLNMapCamera *seed=[initial copy];
        seed.centerCoordinate=CLLocationCoordinate2DMake((bounds.sw.latitude+bounds.ne.latitude)/2,std::remainder((bounds.sw.longitude+bounds.ne.longitude)/2,360.));
        seed.altitude=MLNAltitudeForZoomLevel(_map.zoomLevel,seed.pitch,seed.centerCoordinate.latitude,_map.bounds.size);
        [_map setCamera:seed withDuration:0 animationTimingFunction:nil edgePadding:padding completionHandler:nil];
        [_map setVisibleCoordinates:corners count:4 edgePadding:padding direction:_map.direction duration:0 animationTimingFunction:nil completionHandler:nil];
        BOOL contained=NO;
        // The SDK's pitched fit can place corners outside its requested padding.
        // Refine using its actual projection, on one UI-thread turn before drawing.
        for(int attempt=0;attempt<=32;++attempt) {
          contained=YES;double ratio=1;
          CGPoint pivot=[_map convertCoordinate:_map.camera.centerCoordinate toPointToView:_map];
          EMFitRequire(std::isfinite(pivot.x) && std::isfinite(pivot.y),@"Could not project fitted camera");
          for(CLLocationCoordinate2D coordinate:corners) {
            // Fit bounds are deliberately unwrapped across the dateline, but
            // public coordinate projection expects geographic longitudes.
            coordinate.longitude=std::remainder(coordinate.longitude,360.);
            CGPoint point=[_map convertCoordinate:coordinate toPointToView:_map];
            if(!std::isfinite(point.x) || !std::isfinite(point.y)) { contained=NO;ratio=16;break; }
            if(point.x<effectivePadding.left-1e-6 || point.x>_map.bounds.size.width-effectivePadding.right+1e-6 || point.y<effectivePadding.top-1e-6 || point.y>_map.bounds.size.height-effectivePadding.bottom+1e-6)contained=NO;
            ratio=std::max({ratio,(pivot.x-point.x)/std::max(1.,pivot.x-effectivePadding.left),(point.x-pivot.x)/std::max(1.,_map.bounds.size.width-effectivePadding.right-pivot.x),(pivot.y-point.y)/std::max(1.,pivot.y-effectivePadding.top),(point.y-pivot.y)/std::max(1.,_map.bounds.size.height-effectivePadding.bottom-pivot.y)});
          }
          if(contained || attempt==32)break;
          double zoom=_map.zoomLevel,next=std::max(_map.minimumZoomLevel,zoom-std::clamp(std::log2(ratio),.25,4.));
          if(next>=zoom-1e-9)break;
          MLNMapCamera *wider=[_map.camera copy];
          wider.altitude=MLNAltitudeForZoomLevel(next,wider.pitch,wider.centerCoordinate.latitude,_map.bounds.size);
          [_map setCamera:wider withDuration:0 animationTimingFunction:nil edgePadding:padding completionHandler:nil];
        }
        EMFitRequire(contained,@"Could not fit coordinates within padded viewport");
        MLNMapCamera *target=[_map.camera copy];
        // Tighten excessively wide SDK seeds, retaining only verified cameras.
        double low=_map.zoomLevel,high=_map.maximumZoomLevel;
        for(int attempt=0;attempt<16 && high-low>.001;++attempt) {
          double zoom=(low+high)/2;
          MLNMapCamera *candidate=[target copy];
          candidate.altitude=MLNAltitudeForZoomLevel(zoom,candidate.pitch,candidate.centerCoordinate.latitude,_map.bounds.size);
          [_map setCamera:candidate withDuration:0 animationTimingFunction:nil edgePadding:padding completionHandler:nil];
          BOOL fits=YES;
          for(CLLocationCoordinate2D coordinate:corners) {
            coordinate.longitude=std::remainder(coordinate.longitude,360.);
            CGPoint point=[_map convertCoordinate:coordinate toPointToView:_map];
            if(!std::isfinite(point.x) || !std::isfinite(point.y) || point.x<effectivePadding.left+1 || point.x>_map.bounds.size.width-effectivePadding.right-1 || point.y<effectivePadding.top+1 || point.y>_map.bounds.size.height-effectivePadding.bottom-1) { fits=NO;break; }
          }
          if(fits) { low=zoom;target=[_map.camera copy]; } else high=zoom;
        }
        [_map setCamera:target withDuration:0 animationTimingFunction:nil edgePadding:padding completionHandler:nil];
        if(duration>0) {
          [_map setCamera:initial withDuration:0 animationTimingFunction:nil edgePadding:oldPadding completionHandler:nil];
          _fitPreflight=NO;
          [_map setCamera:target withDuration:duration/1000 animationTimingFunction:[CAMediaTimingFunction functionWithName:kCAMediaTimingFunctionEaseInEaseOut] edgePadding:padding completionHandler:nil];
        } else {
          _fitPreflight=NO;
          [self mapView:_map regionDidChangeWithReason:MLNCameraChangeReasonProgrammatic animated:NO];
        }
      } @catch(NSException *error) {
        _fitPreflight=YES;
        [_map setCamera:initial withDuration:0 animationTimingFunction:nil edgePadding:oldPadding completionHandler:nil];
        @throw error;
      } @finally { _fitPreflight=NO;_cameraOrigins.applicationCallEnded(); }
      response=@{@"accepted":@YES};
    } else if([request[@"kind"] isEqual:@"point"]) {
      double latitude=number(@"latitude"),longitude=number(@"longitude");
      if(std::abs(latitude)>90 || std::abs(longitude)>180)@throw [NSException exceptionWithName:@"MapQuery" reason:@"Invalid map coordinate" userInfo:nil];
      CGPoint point=[_map convertCoordinate:CLLocationCoordinate2DMake(latitude,longitude) toPointToView:_map];
      response=@{@"x":@(point.x),@"y":@(point.y)};
    } else if([request[@"kind"] isEqual:@"coordinate"]) {
      CLLocationCoordinate2D coordinate=[_map convertPoint:CGPointMake(number(@"x"),number(@"y")) toCoordinateFromView:_map];
      response=@{@"latitude":@(coordinate.latitude),@"longitude":@(coordinate.longitude)};
    } else if([request[@"kind"] isEqual:@"camera"]) {
      response=@{@"center":@{@"latitude":@(_map.centerCoordinate.latitude),@"longitude":@(_map.centerCoordinate.longitude)},@"zoom":@(_map.zoomLevel),@"heading":@(_map.direction),@"pitch":@(_map.camera.pitch)};
    } else if([request[@"kind"] isEqual:@"bounds"]) {
      MLNCoordinateBounds bounds=_map.visibleCoordinateBounds;
      response=@{@"north":@(bounds.ne.latitude),@"east":@(bounds.ne.longitude),@"south":@(bounds.sw.latitude),@"west":@(bounds.sw.longitude)};
    } else @throw [NSException exceptionWithName:@"MapQuery" reason:@"Unknown map query" userInfo:nil];
    NSData *data=[NSJSONSerialization dataWithJSONObject:response options:0 error:nil];
    if(!data)@throw [NSException exceptionWithName:@"MapQuery" reason:@"Could not project map geometry" userInfo:nil];
    result=[[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding];
  } @catch(NSException *error) { failure=error.reason?:@"Invalid map query"; }
  std::static_pointer_cast<const EnhancedMapLibreViewEventEmitter>(_eventEmitter)->onMapQueryResult({requestId,revision,std::string(result.UTF8String),std::string(failure.UTF8String)});
}
- (void)emitMapPress:(const char *)action point:(CGPoint)point {
  const auto &p=*std::static_pointer_cast<const EnhancedMapLibreViewProps>(_props);
  if(!p.mapPressEventsEnabled || !_ready || !_eventEmitter || !self.window)return;
  CLLocationCoordinate2D coordinate=[_map convertPoint:point toCoordinateFromView:_map];
  std::static_pointer_cast<const EnhancedMapLibreViewEventEmitter>(_eventEmitter)->onMapPress({action,coordinate.latitude,coordinate.longitude,point.x,point.y,_readyStyleRevision});
}
- (void)dealloc {
#if DEBUG && MLN_RENDER_BACKEND_METAL
  [_shaderPrototype stop];
#endif
  _cameraOrigins.reset(); _map.sdkCameraOperation=nil;
  _gestureEvents.reset();
  for(UIGestureRecognizer *recognizer in _observedGestures)[recognizer removeTarget:self action:@selector(observeNativeGesture:)];
  [[NSNotificationCenter defaultCenter] removeObserver:self];
  _sourceRevisions.close(); _map.delegate=nil; [_map removeAnnotations:_map.annotations]; }
@end
Class<RCTComponentViewProtocol> EnhancedMapLibreViewCls(void) { return EMMapLibreView.class; }
