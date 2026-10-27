#import "MapUserLocation.h"
#import <CoreLocation/CoreLocation.h>
#import <UIKit/UIKit.h>
#include <cmath>

@interface EMMapUserLocation () <CLLocationManagerDelegate>
@end
@implementation EMMapUserLocation {
  CLLocationManager *_manager;
  void (^_location)(NSString *);
  void (^_error)(NSString *,NSString *);
  BOOL _enabled;
  BOOL _paused;
  BOOL _background;
  BOOL _closed;
  BOOL _running;
  NSString *_lastError;
}
- (instancetype)initWithLocation:(void (^)(NSString *))location error:(void (^)(NSString *,NSString *))error {
  if((self=[super init])) {
    _location=[location copy];_error=[error copy];
    _paused=YES;
    _background=UIApplication.sharedApplication.applicationState==UIApplicationStateBackground;
    [[NSNotificationCenter defaultCenter] addObserver:self selector:@selector(didBackground:) name:UIApplicationDidEnterBackgroundNotification object:nil];
    [[NSNotificationCenter defaultCenter] addObserver:self selector:@selector(didForeground:) name:UIApplicationWillEnterForegroundNotification object:nil];
  }
  return self;
}
- (void)report:(NSString *)code message:(NSString *)message {
  if(_closed || [_lastError isEqual:code])return;
  _lastError=code;
  if(_error)_error(code,message);
}
- (void)stop {
  if(_running)[_manager stopUpdatingLocation];
  _running=NO;
}
- (void)reconcile {
  if(_closed || !_enabled || _paused || _background) { [self stop];return; }
  if(!_manager) {
    _manager=[CLLocationManager new];_manager.delegate=self;
    _manager.desiredAccuracy=kCLLocationAccuracyBest;_manager.distanceFilter=kCLDistanceFilterNone;
    _manager.pausesLocationUpdatesAutomatically=YES;
    _manager.allowsBackgroundLocationUpdates=NO;
  }
  CLAuthorizationStatus status=_manager.authorizationStatus;
  if(status!=kCLAuthorizationStatusAuthorizedAlways && status!=kCLAuthorizationStatusAuthorizedWhenInUse) {
    [self stop];
    [self report:@"location-permission" message:@"Location permission must be granted by the application before showing native user location"];
    return;
  }
  id purpose=NSBundle.mainBundle.infoDictionary[@"NSLocationWhenInUseUsageDescription"];
  if(![purpose isKindOfClass:NSString.class] || ![(NSString *)purpose length]) {
    [self stop];[self report:@"location-configuration" message:@"The application must provide NSLocationWhenInUseUsageDescription before enabling native location"];return;
  }
  _lastError=nil;
  if(!_running) { _running=YES;[_manager startUpdatingLocation]; }
}
- (void)configure:(BOOL)enabled {
  if(_closed)return;
  if(_enabled!=enabled)_lastError=nil;
  _enabled=enabled;[self reconcile];
}
- (void)pause { if(!_closed) { _paused=YES;[self stop]; } }
- (void)resume { if(!_closed) { _paused=NO;[self reconcile]; } }
- (void)didBackground:(NSNotification *)notification { _background=YES;[self reconcile]; }
- (void)didForeground:(NSNotification *)notification { _background=NO;[self reconcile]; }
- (void)locationManagerDidChangeAuthorization:(CLLocationManager *)manager { [self reconcile]; }
- (void)locationManager:(CLLocationManager *)manager didUpdateLocations:(NSArray<CLLocation *> *)locations {
  if(_closed || !_enabled || _paused || _background || !_running)return;
  CLLocation *fix=locations.lastObject;
  if(!fix || !std::isfinite(fix.horizontalAccuracy) || fix.horizontalAccuracy<0 || fix.timestamp.timeIntervalSince1970<0 || !CLLocationCoordinate2DIsValid(fix.coordinate))return;
  // CoreLocation may initially supply a cached fix. Do not present an old position as current.
  NSTimeInterval age=-fix.timestamp.timeIntervalSinceNow;
  if(age>30 || age < -60)return;
  NSMutableDictionary *value=[@{@"latitude":@(fix.coordinate.latitude),@"longitude":@(fix.coordinate.longitude),@"accuracy":@(fix.horizontalAccuracy),@"timestamp":@(fix.timestamp.timeIntervalSince1970*1000)} mutableCopy];
  if(fix.verticalAccuracy>=0 && std::isfinite(fix.altitude))value[@"altitude"]=@(fix.altitude);
  if(fix.course>=0 && fix.course<360 && std::isfinite(fix.course))value[@"heading"]=@(fix.course);
  if(fix.speed>=0 && std::isfinite(fix.speed))value[@"speed"]=@(fix.speed);
  NSData *data=[NSJSONSerialization dataWithJSONObject:value options:0 error:nil];
  if(data && _location)_location([[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding]);
}
- (void)locationManager:(CLLocationManager *)manager didFailWithError:(NSError *)error {
  if(_closed || !_enabled || _paused || _background)return;
  if(error.code==kCLErrorDenied) { [self stop];[self report:@"location-permission" message:@"Location permission was denied or revoked"]; }
  else [self report:@"location-unavailable" message:@"A current location fix is unavailable"];
}
- (void)close {
  if(_closed)return;
  _closed=YES;[self stop];_enabled=NO;_manager.delegate=nil;_manager=nil;_location=nil;_error=nil;
  [[NSNotificationCenter defaultCenter] removeObserver:self];
}
- (void)dealloc { [self close]; }
@end
