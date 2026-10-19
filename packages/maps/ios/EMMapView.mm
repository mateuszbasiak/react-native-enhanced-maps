#import "EMMapView.h"
#import "CameraEventGate.h"
#import "EMRasterOverlay.h"
#import <MapKit/MapKit.h>
#import <QuartzCore/QuartzCore.h>
#import <react/renderer/components/EnhancedMapsSpec/ComponentDescriptors.h>
#import <react/renderer/components/EnhancedMapsSpec/EventEmitters.h>
#import <react/renderer/components/EnhancedMapsSpec/Props.h>
#import <react/renderer/components/EnhancedMapsSpec/RCTComponentViewHelpers.h>
#if EM_GOOGLE_MAPS
#import <GoogleMaps/GoogleMaps.h>
#endif

using namespace facebook::react;
@interface EMMapView () <MKMapViewDelegate, RCTEnhancedMapViewViewProtocol
#if EM_GOOGLE_MAPS
, GMSMapViewDelegate
#endif
>
@end

@implementation EMMapView {
  enhancedmaps::CameraEventGate _cameraEvents;
  NSString *_rasterSource;
  EMRasterOverlay *_raster;
#if EM_GOOGLE_MAPS
  GMSGroundOverlay *_googleRaster;
#endif
  MKMapView *_apple;
#if EM_GOOGLE_MAPS
  GMSMapView *_google;
#endif
  NSString *_provider;
  BOOL _configured;
  BOOL _readySent;
  BOOL _disposed;
  NSString *_origin;
}
+ (ComponentDescriptorProvider)componentDescriptorProvider {
  return concreteComponentDescriptorProvider<EnhancedMapViewComponentDescriptor>();
}
- (instancetype)initWithFrame:(CGRect)frame {
  if ((self = [super initWithFrame:frame])) {
    _props = std::make_shared<const EnhancedMapViewProps>();
    _origin = @"unknown";
  }
  return self;
}
- (void)updateProps:(Props::Shared const &)props oldProps:(Props::Shared const &)oldProps {
  [super updateProps:props oldProps:oldProps];
  if (_configured) {
    const auto &next = *std::static_pointer_cast<const EnhancedMapViewProps>(props);
    if (_provider && ![_provider isEqualToString:@(next.provider.c_str())]) {
      [self emitError:@"provider-change" message:@"Remount MapView to change provider"];
    }
    [self updateRaster];
    return;
  }
  [self configureIfNeeded];
}
- (void)updateEventEmitter:(EventEmitter::Shared const &)eventEmitter {
  [super updateEventEmitter:eventEmitter];
  [self configureIfNeeded];
}
- (void)configureIfNeeded {
  if (_configured || _disposed || !self.window || !_eventEmitter) return;
  _configured = YES;
  const auto &p = *std::static_pointer_cast<const EnhancedMapViewProps>(_props);
  _provider = @(p.provider.c_str());
  if ([_provider isEqualToString:@"google"]) {
#if EM_GOOGLE_MAPS
    NSString *key = [[NSBundle mainBundle] objectForInfoDictionaryKey:@"EnhancedMapsGoogleApiKey"];
    if (key.length == 0 || [key hasPrefix:@"$("]) {
      [self emitError:@"missing-api-key" message:@"Set EnhancedMapsGoogleApiKey in the application's Info.plist"];
      return;
    }
    [GMSServices provideAPIKey:key];
    _google = [[GMSMapView alloc] initWithFrame:self.bounds];
    _google.delegate = self;
    self.contentView = _google;
#else
    [self emitError:@"provider-unavailable" message:@"Reinstall pods with ENHANCED_MAPS_GOOGLE_IOS=1 to enable Google Maps"];
    return;
#endif
  } else {
    _apple = [[MKMapView alloc] initWithFrame:self.bounds];
    _apple.delegate = self;
    self.contentView = _apple;
  }
  [self updateRaster];
  [self animateCamera:p.initialLatitude longitude:p.initialLongitude zoom:p.initialZoom heading:p.initialHeading pitch:p.initialPitch durationMs:0];
}
- (void)updateRaster {
  const auto &p = *std::static_pointer_cast<const EnhancedMapViewProps>(_props);
  NSString *source = @(p.rasterOverlay.c_str());
  if ([_rasterSource isEqualToString:source]) return;
  _rasterSource = source;
  if (_raster && _apple) [_apple removeOverlay:_raster];
  _raster = nil;
#if EM_GOOGLE_MAPS
  _googleRaster.map = nil; _googleRaster = nil;
#endif
  if (source.length == 0 || _disposed) return;
  _raster = [EMRasterOverlay fromJSON:source];
  if (!_raster) { [self emitError:@"raster-overlay" message:@"Invalid raster overlay payload"]; return; }
  if (_apple) [_apple addOverlay:_raster level:MKOverlayLevelAboveRoads];
#if EM_GOOGLE_MAPS
  if (_google) {
    GMSCoordinateBounds *bounds = [[GMSCoordinateBounds alloc] initWithCoordinate:_raster.southWest coordinate:_raster.northEast];
    _googleRaster = [GMSGroundOverlay groundOverlayWithBounds:bounds icon:_raster.image];
    _googleRaster.zIndex = 1; _googleRaster.tappable = NO; _googleRaster.map = _google;
  }
#endif
}
- (MKOverlayRenderer *)mapView:(MKMapView *)mapView rendererForOverlay:(id<MKOverlay>)overlay {
  if ([overlay isKindOfClass:EMRasterOverlay.class]) return [[EMRasterRenderer alloc] initWithOverlay:overlay];
  return [[MKOverlayRenderer alloc] initWithOverlay:overlay];
}
- (void)didMoveToWindow {
  [super didMoveToWindow];
  if (self.window) [self configureIfNeeded];
}
- (void)emitError:(NSString *)code message:(NSString *)message {
  if (_disposed || !_eventEmitter) return;
  auto emitter = std::static_pointer_cast<const EnhancedMapViewEventEmitter>(_eventEmitter);
  emitter->onMapError({std::string(code.UTF8String), std::string(message.UTF8String)});
}
- (void)emitReady {
  if (_readySent || _disposed || !_eventEmitter) return;
  _readySent = YES;
  auto emitter = std::static_pointer_cast<const EnhancedMapViewEventEmitter>(_eventEmitter);
  emitter->onMapReady({std::string(_provider.UTF8String)});
}
- (void)handleCommand:(NSString const *)commandName args:(NSArray const *)args {
  RCTEnhancedMapViewHandleCommand(self, commandName, args);
}
- (void)animateCamera:(double)latitude longitude:(double)longitude zoom:(double)zoom heading:(double)heading pitch:(double)pitch durationMs:(double)durationMs {
  if (_disposed || !std::isfinite(latitude) || !std::isfinite(longitude) || !std::isfinite(zoom) || !std::isfinite(heading) || !std::isfinite(pitch) || !std::isfinite(durationMs)) return;
  _origin = @"application";
#if EM_GOOGLE_MAPS
  if (_google) {
    GMSCameraPosition *camera = [GMSCameraPosition cameraWithLatitude:latitude longitude:longitude zoom:zoom bearing:heading viewingAngle:pitch];
    if (durationMs <= 0) _google.camera = camera;
    else {
      [CATransaction begin];
      [CATransaction setAnimationDuration:durationMs / 1000.0];
      [_google animateToCameraPosition:camera];
      [CATransaction commit];
    }
    return;
  }
#endif
  if (_apple) {
    // Provisional zoom conversion; does not establish cross-provider projection parity.
    double width = MAX(self.bounds.size.width, 1.0);
    double metersPerPixel = 40075016.686 * cos(latitude * M_PI / 180.0) / (256.0 * pow(2.0, zoom));
    CLLocationDistance distance = MAX(1.0, metersPerPixel * width);
    MKMapCamera *camera = [MKMapCamera cameraLookingAtCenterCoordinate:CLLocationCoordinate2DMake(latitude, longitude) fromDistance:distance pitch:MIN(pitch, 80) heading:heading];
    [CATransaction begin];
    [CATransaction setAnimationDuration:durationMs / 1000.0];
    [_apple setCamera:camera animated:durationMs > 0];
    [CATransaction commit];
  }
}
- (void)mapViewDidFinishLoadingMap:(MKMapView *)mapView { [self emitReady]; }
- (void)mapViewDidFinishRenderingMap:(MKMapView *)mapView fullyRendered:(BOOL)fullyRendered {
  if (fullyRendered) [self emitReady];
}
- (void)mapViewDidFailLoadingMap:(MKMapView *)mapView withError:(NSError *)error {
  [self emitError:@"map-load" message:@"MapKit failed to load map content"];
}
- (void)mapView:(MKMapView *)mapView regionWillChangeAnimated:(BOOL)animated { _cameraEvents.beginMovement(); }
- (void)mapViewDidChangeVisibleRegion:(MKMapView *)mapView {
  _cameraEvents.beginMovement();
  [self emitAppleCamera:NO];
}
- (void)emitAppleCamera:(BOOL)finalPosition {
  if (_disposed || !_eventEmitter || !_apple || self.bounds.size.width <= 0) return;
  const auto &p = *std::static_pointer_cast<const EnhancedMapViewProps>(_props);
  if (!p.cameraEventsEnabled && !(finalPosition && p.cameraIdleEventsEnabled)) return;
  double zoom = log2(MKMapSizeWorld.width * self.bounds.size.width / (256.0 * MAX(_apple.visibleMapRect.size.width, 1.0)));
  auto emitter = std::static_pointer_cast<const EnhancedMapViewEventEmitter>(_eventEmitter);
  if (_cameraEvents.shouldEmit(CACurrentMediaTime() * 1000, p.cameraEventsEnabled, p.cameraEventIntervalMs, finalPosition)) {
    emitter->onCameraChange({_apple.centerCoordinate.latitude, _apple.centerCoordinate.longitude, zoom, _apple.camera.heading, _apple.camera.pitch, std::string(_origin.UTF8String)});
  }
  if (finalPosition && p.cameraIdleEventsEnabled) {
    emitter->onCameraIdle({_apple.centerCoordinate.latitude, _apple.centerCoordinate.longitude, zoom, _apple.camera.heading, _apple.camera.pitch, std::string(_origin.UTF8String)});
  }
}
- (void)mapView:(MKMapView *)mapView regionDidChangeAnimated:(BOOL)animated {
  if (_cameraEvents.finishMovement()) [self emitAppleCamera:YES];
  _origin = @"unknown"; // Detailed MapKit gesture provenance remains a separate capability.
}
#if EM_GOOGLE_MAPS
- (void)mapViewSnapshotReady:(GMSMapView *)mapView { [self emitReady]; }
- (void)mapView:(GMSMapView *)mapView willMove:(BOOL)gesture {
  _cameraEvents.beginMovement();
  _origin = gesture ? @"gesture" : ([_origin isEqualToString:@"application"] ? @"application" : @"unknown");
}
- (void)mapView:(GMSMapView *)mapView didChangeCameraPosition:(GMSCameraPosition *)position {
  _cameraEvents.beginMovement();
  [self emitGoogleCamera:position finalPosition:NO];
}
- (void)emitGoogleCamera:(GMSCameraPosition *)position finalPosition:(BOOL)finalPosition {
  if (_disposed || !_eventEmitter) return;
  const auto &p = *std::static_pointer_cast<const EnhancedMapViewProps>(_props);
  if (!p.cameraEventsEnabled && !(finalPosition && p.cameraIdleEventsEnabled)) return;
  auto emitter = std::static_pointer_cast<const EnhancedMapViewEventEmitter>(_eventEmitter);
  if (_cameraEvents.shouldEmit(CACurrentMediaTime() * 1000, p.cameraEventsEnabled, p.cameraEventIntervalMs, finalPosition)) {
  emitter->onCameraChange({position.target.latitude, position.target.longitude, position.zoom, position.bearing, position.viewingAngle, std::string(_origin.UTF8String)});
  }
  if (finalPosition && p.cameraIdleEventsEnabled) {
    emitter->onCameraIdle({position.target.latitude, position.target.longitude, position.zoom, position.bearing, position.viewingAngle, std::string(_origin.UTF8String)});
  }
}
- (void)mapView:(GMSMapView *)mapView idleAtCameraPosition:(GMSCameraPosition *)position { if (_cameraEvents.finishMovement()) [self emitGoogleCamera:position finalPosition:YES]; _origin = @"unknown"; }
#endif
- (void)prepareForRecycle {
  _disposed = YES;
  if (_raster && _apple) [_apple removeOverlay:_raster];
  _raster = nil; _rasterSource = nil;
#if EM_GOOGLE_MAPS
  _googleRaster.map = nil; _googleRaster = nil;
#endif
  _apple.delegate = nil;
  [_apple removeFromSuperview];
  _apple = nil;
#if EM_GOOGLE_MAPS
  _google.delegate = nil;
  [_google removeFromSuperview];
  _google = nil;
#endif
  self.contentView = nil;
  [super prepareForRecycle];
  _cameraEvents.reset();
  _configured = NO;
  _readySent = NO;
  _provider = nil;
  _origin = @"unknown";
  _disposed = NO;
}
@end
