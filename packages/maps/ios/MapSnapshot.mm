#import "MapSnapshot.h"
#import "SnapshotResources.h"
#include <cmath>
#include <algorithm>

static const NSUInteger EMSnapshotMaxBytes=32*1024*1024;
static NSString *EMSnapshotDirectory(void) {
  NSString *base=NSSearchPathForDirectoriesInDomains(NSCachesDirectory,NSUserDomainMask,YES).firstObject;
  NSString *directory=[base stringByAppendingPathComponent:@"enhanced-map-snapshots"];
  [[NSFileManager defaultManager] createDirectoryAtPath:directory withIntermediateDirectories:YES attributes:nil error:nil];
  return directory;
}
static void EMSnapshotPrune(NSString *directory) {
  NSFileManager *files=NSFileManager.defaultManager;
  NSArray<NSURL *> *entries=[files contentsOfDirectoryAtURL:[NSURL fileURLWithPath:directory] includingPropertiesForKeys:@[NSURLContentModificationDateKey] options:NSDirectoryEnumerationSkipsHiddenFiles error:nil];
  entries=[entries sortedArrayUsingComparator:^NSComparisonResult(NSURL *a,NSURL *b) { NSDate *ad,*bd;[a getResourceValue:&ad forKey:NSURLContentModificationDateKey error:nil];[b getResourceValue:&bd forKey:NSURLContentModificationDateKey error:nil];return [(ad?:NSDate.distantPast) compare:(bd?:NSDate.distantPast)]; }];
  NSDate *cutoff=[NSDate dateWithTimeIntervalSinceNow:-86400];
  NSUInteger count=entries.count;
  for(NSURL *entry in entries) { NSDate *date;[entry getResourceValue:&date forKey:NSURLContentModificationDateKey error:nil];if(count>=16 || !date || [date compare:cutoff]==NSOrderedAscending) { [files removeItemAtURL:entry error:nil];count--; } }
}
@implementation EMMapSnapshot {
  MLNMapSnapshotter *_snapshotter;
  NSURL *_styleFile;
  BOOL _finished;
  void (^_completion)(NSDictionary *,NSString *);
}
- (void)finish:(NSDictionary *)result error:(NSString *)error {
  if(_finished) { if(result)[EMMapSnapshot discardResult:result];return; }
  _finished=YES;
  [_snapshotter cancel];_snapshotter=nil;
  if(_styleFile)[NSFileManager.defaultManager removeItemAtURL:_styleFile error:nil];_styleFile=nil;
  void (^callback)(NSDictionary *,NSString *)=_completion;_completion=nil;
  if(callback)dispatch_async(dispatch_get_main_queue(),^{callback(result,error);});
}
+ (instancetype)startWithMap:(MLNMapView *)map markers:(NSArray<UIView *> *)markers request:(NSDictionary *)request completion:(void (^)(NSDictionary *,NSString *))completion {
  EMMapSnapshot *operation=[EMMapSnapshot new];operation->_completion=[completion copy];
  @try { [operation beginWithMap:map markers:markers request:request]; }
  @catch(NSException *exception) { [operation finish:nil error:exception.reason?:@"Could not capture map"]; }
  return operation;
}
- (void)beginWithMap:(MLNMapView *)map markers:(NSArray<UIView *> *)markers request:(NSDictionary *)request {
  if(!NSThread.isMainThread || !map.window || !map.style || map.bounds.size.width<=0 || map.bounds.size.height<=0) { [self finish:nil error:@"Snapshot requires a mounted ready map"];return; }
  double width=[request[@"width"] doubleValue],height=[request[@"height"] doubleValue],quality=[request[@"quality"] doubleValue];
  if(!std::isfinite(width)||!std::isfinite(height)||!std::isfinite(quality)||width<0||height<0||width>4096||height>4096||quality<0||quality>1||std::floor(width)!=width||std::floor(height)!=height) { [self finish:nil error:@"Invalid snapshot dimensions or quality"];return; }
  UIEdgeInsets content=map.contentInset, cameraInsets=map.cameraEdgeInsets;
  if(map.camera.pitch>0 && (!UIEdgeInsetsEqualToEdgeInsets(content,UIEdgeInsetsZero) || !UIEdgeInsetsEqualToEdgeInsets(cameraInsets,UIEdgeInsetsZero))) {
    [self finish:nil error:@"iOS snapshots with both pitch and map padding are not supported; use a flat camera or clear padding"];return;
  }
  CGSize viewport=map.bounds.size;
  CGFloat scale=map.window.screen.scale;
  CGFloat captureScale=std::min({scale,4096./viewport.width,4096./viewport.height,std::sqrt(16000000./(viewport.width*viewport.height))});
  if(captureScale<1) { [self finish:nil error:@"Mounted viewport exceeds snapshot capture budget"];return; }
  if(width==0 && height==0) {width=std::round(viewport.width*scale);height=std::round(viewport.height*scale);}
  else if(width==0)width=std::round(height*viewport.width/viewport.height);
  else if(height==0)height=std::round(width*viewport.height/viewport.width);
  if(width<1||height<1||width>4096||height>4096||width*height>16000000) { [self finish:nil error:@"Snapshot exceeds pixel budget"];return; }
  NSString *format=request[@"format"],*resultType=request[@"result"];
  if(![@[@"png",@"jpg"] containsObject:format]||![@[@"file",@"base64"] containsObject:resultType]) { [self finish:nil error:@"Invalid snapshot output"];return; }
  // Serialize the active scene. A separate snapshotter does not copy live styles.
  NSData *styleData=[map.style.styleJSON dataUsingEncoding:NSUTF8StringEncoding];
  NSMutableDictionary *style=[NSJSONSerialization JSONObjectWithData:styleData options:NSJSONReadingMutableContainers error:nil];
  if(![style isKindOfClass:NSMutableDictionary.class]) { [self finish:nil error:@"Could not serialize current map style"];return; }
  NSMutableArray *layers=style[@"layers"];
  NSIndexSet *custom=[layers indexesOfObjectsPassingTest:^BOOL(NSDictionary *layer,NSUInteger index,BOOL *stop) {return [layer[@"type"] isEqual:@"custom"];}];
  [layers removeObjectsAtIndexes:custom];
  NSURL *base=map.styleURL;
  for(NSString *key in @[@"sprite",@"glyphs"])if([style[key] isKindOfClass:NSString.class])style[key]=EMSnapshotResource(style[key],base);
  for(NSMutableDictionary *source in [style[@"sources"] allValues]) {
    for(NSString *key in @[@"url",@"data"])if([source[key] isKindOfClass:NSString.class])source[key]=EMSnapshotResource(source[key],base);
    if([source[@"tiles"] isKindOfClass:NSArray.class]) { NSMutableArray *tiles=[NSMutableArray new];for(NSString *tile in source[@"tiles"])[tiles addObject:EMSnapshotResource(tile,base)];source[@"tiles"]=tiles; }
  }
  NSData *serialized=[NSJSONSerialization dataWithJSONObject:style options:0 error:nil];
  _styleFile=[NSURL fileURLWithPath:[NSTemporaryDirectory() stringByAppendingPathComponent:[NSString stringWithFormat:@"enhanced-map-style-%@.json",NSUUID.UUID.UUIDString]]];
  if(![serialized writeToURL:_styleFile atomically:YES]) { [self finish:nil error:@"Could not prepare snapshot style"];return; }
  // Copy marker pixels and geometry before asynchronous resource loading.
  NSMutableArray<NSDictionary *> *overlays=[NSMutableArray new];
  NSArray<UIView *> *orderedMarkers=[markers sortedArrayUsingComparator:^NSComparisonResult(UIView *a,UIView *b) {return a.layer.zPosition==b.layer.zPosition?NSOrderedSame:(a.layer.zPosition<b.layer.zPosition?NSOrderedAscending:NSOrderedDescending);}];
  for(UIView *marker in orderedMarkers) {
    if(marker.hidden || !marker.superview || marker.bounds.size.width<=0 || marker.bounds.size.height<=0)continue;
    CGRect frame=[marker convertRect:marker.bounds toView:map];
    if(marker.bounds.size.width*captureScale>4096 || marker.bounds.size.height*captureScale>4096 || marker.bounds.size.width*marker.bounds.size.height*captureScale*captureScale>16000000) { [self finish:nil error:@"Marker exceeds snapshot capture budget"];return; }
    UIGraphicsImageRendererFormat *markerFormat=[UIGraphicsImageRendererFormat defaultFormat];markerFormat.scale=captureScale;
    UIImage *image=[[[UIGraphicsImageRenderer alloc] initWithSize:marker.bounds.size format:markerFormat] imageWithActions:^(UIGraphicsImageRendererContext *context) { [marker.layer renderInContext:context.CGContext]; }];
    [overlays addObject:@{@"image":image,@"frame":[NSValue valueWithCGRect:frame]}];
  }
  MLNMapCamera *camera=[map.camera copy];
  camera.centerCoordinate=[map convertPoint:CGPointMake(CGRectGetMidX(map.bounds),CGRectGetMidY(map.bounds)) toCoordinateFromView:map];
  MLNMapSnapshotOptions *options=[[MLNMapSnapshotOptions alloc] initWithStyleURL:_styleFile camera:camera size:viewport];
  options.scale=captureScale;options.zoomLevel=map.zoomLevel;options.showsAttribution=YES;options.showsLogo=YES;
  _snapshotter=[[MLNMapSnapshotter alloc] initWithOptions:options];
  __weak EMMapSnapshot *weakSelf=self;
  dispatch_after(dispatch_time(DISPATCH_TIME_NOW,4*NSEC_PER_SEC),dispatch_get_main_queue(),^{ [weakSelf finish:nil error:@"Snapshot timed out"]; });
  [_snapshotter startWithCompletionHandler:^(MLNMapSnapshot *snapshot,NSError *error) {
    EMMapSnapshot *strongSelf=weakSelf;if(!strongSelf||strongSelf->_finished)return;
    if(error||!snapshot.image) { [strongSelf finish:nil error:error.localizedDescription?:@"Could not render snapshot"];return; }
    UIGraphicsImageRendererFormat *outputFormat=[UIGraphicsImageRendererFormat defaultFormat];outputFormat.scale=1;outputFormat.opaque=[format isEqual:@"jpg"];
    UIImage *image=[[[UIGraphicsImageRenderer alloc] initWithSize:CGSizeMake(width,height) format:outputFormat] imageWithActions:^(UIGraphicsImageRendererContext *context) {
      if([format isEqual:@"jpg"]) { [UIColor.whiteColor setFill];UIRectFill(CGRectMake(0,0,width,height)); }
      [snapshot.image drawInRect:CGRectMake(0,0,width,height)];
      for(NSDictionary *overlay in overlays) {CGRect rect=[overlay[@"frame"] CGRectValue];rect=CGRectMake(rect.origin.x*width/viewport.width,rect.origin.y*height/viewport.height,rect.size.width*width/viewport.width,rect.size.height*height/viewport.height);[(UIImage *)overlay[@"image"] drawInRect:rect];}
    }];
    dispatch_async(dispatch_get_global_queue(QOS_CLASS_UTILITY,0),^{
      NSData *data=[format isEqual:@"jpg"]?UIImageJPEGRepresentation(image,quality):UIImagePNGRepresentation(image);
      NSString *failure=nil;NSDictionary *result=nil;
      if(!data.length||data.length>EMSnapshotMaxBytes)failure=@"Snapshot exceeds encoded byte budget";
      else if([resultType isEqual:@"base64"])result=@{@"value":[data base64EncodedStringWithOptions:0],@"file":@NO};
      else { NSString *directory=EMSnapshotDirectory();EMSnapshotPrune(directory);NSString *path=[directory stringByAppendingPathComponent:[NSString stringWithFormat:@"map-%@.%@",NSUUID.UUID.UUIDString,format]];if([data writeToFile:path atomically:YES])result=@{@"value":[NSURL fileURLWithPath:path].absoluteString,@"file":@YES};else failure=@"Could not write snapshot file"; }
      dispatch_async(dispatch_get_main_queue(),^{[strongSelf finish:result error:failure];});
    });
  }];
}
- (void)cancel { [self finish:nil error:@"Snapshot cancelled"]; }
+ (void)discardResult:(NSDictionary *)result {
  if([result[@"file"] boolValue] && [result[@"value"] isKindOfClass:NSString.class]) { NSURL *url=[NSURL URLWithString:result[@"value"]];if(url.isFileURL && [url.path.stringByDeletingLastPathComponent isEqual:EMSnapshotDirectory()])[NSFileManager.defaultManager removeItemAtURL:url error:nil]; }
}
- (void)dealloc {[_snapshotter cancel];if(_styleFile)[NSFileManager.defaultManager removeItemAtURL:_styleFile error:nil];}
@end
