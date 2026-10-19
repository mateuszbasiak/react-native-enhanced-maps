#import "EMMapView.h"
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
  [self animateCamera:p.initialLatitude longitude:p.initialLongitude zoom:p.initialZoom heading:p.initialHeading pitch:p.initialPitch durationMs:0];
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
- (void)mapView:(MKMapView *)mapView regionDidChangeAnimated:(BOOL)animated {
  if (_disposed || !_eventEmitter || self.bounds.size.width <= 0) return;
  double zoom = log2(MKMapSizeWorld.width * self.bounds.size.width / (256.0 * MAX(mapView.visibleMapRect.size.width, 1.0)));
  auto emitter = std::static_pointer_cast<const EnhancedMapViewEventEmitter>(_eventEmitter);
  emitter->onCameraChange({mapView.centerCoordinate.latitude, mapView.centerCoordinate.longitude, zoom, mapView.camera.heading, mapView.camera.pitch, std::string(_origin.UTF8String)});
  _origin = @"unknown"; // Detailed MapKit gesture provenance is not implemented by this spike.
}
#if EM_GOOGLE_MAPS
- (void)mapViewSnapshotReady:(GMSMapView *)mapView { [self emitReady]; }
- (void)mapView:(GMSMapView *)mapView willMove:(BOOL)gesture {
  _origin = gesture ? @"gesture" : ([_origin isEqualToString:@"application"] ? @"application" : @"unknown");
}
- (void)mapView:(GMSMapView *)mapView didChangeCameraPosition:(GMSCameraPosition *)position {
  if (_disposed || !_eventEmitter) return;
  auto emitter = std::static_pointer_cast<const EnhancedMapViewEventEmitter>(_eventEmitter);
  emitter->onCameraChange({position.target.latitude, position.target.longitude, position.zoom, position.bearing, position.viewingAngle, std::string(_origin.UTF8String)});
}
- (void)mapView:(GMSMapView *)mapView idleAtCameraPosition:(GMSCameraPosition *)position { _origin = @"unknown"; }
#endif
- (void)prepareForRecycle {
  _disposed = YES;
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
  _configured = NO;
  _readySent = NO;
  _provider = nil;
  _origin = @"unknown";
  _disposed = NO;
}
@end
