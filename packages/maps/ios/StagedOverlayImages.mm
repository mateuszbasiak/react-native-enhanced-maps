#import "StagedOverlayImages.h"
#import <ImageIO/ImageIO.h>
#import <Metal/Metal.h>

// Apple's Metal feature tables, queried by runtime GPU family; no app pixel quota.
// https://developer.apple.com/metal/capabilities/
static NSUInteger EMOverlayTextureDimension(void) {
  id<MTLDevice> device=MTLCreateSystemDefaultDevice();
#if __IPHONE_OS_VERSION_MAX_ALLOWED >= 260000
  if(@available(iOS 26.0,*))if([device supportsFamily:MTLGPUFamilyApple10])return 32768;
#endif
  if([device supportsFamily:MTLGPUFamilyApple3] || [device supportsFamily:MTLGPUFamilyMac2])return 16384;
  if([device supportsFamily:MTLGPUFamilyApple2])return 8192;
  return 0;
}
static UIImage *EMDecodeOverlayURL(NSURL *url,NSUInteger dimension) {
  CGImageSourceRef source=CGImageSourceCreateWithURL((__bridge CFURLRef)url,(__bridge CFDictionaryRef)@{(id)kCGImageSourceShouldCache:@NO});
  if(!source)return nil;
  NSDictionary *properties=CFBridgingRelease(CGImageSourceCopyPropertiesAtIndex(source,0,NULL));
  NSUInteger width=[properties[(id)kCGImagePropertyPixelWidth] unsignedIntegerValue],height=[properties[(id)kCGImagePropertyPixelHeight] unsignedIntegerValue];
  NSUInteger size=MIN(dimension,MAX(width,height));
  CGImageRef decoded=NULL;
  while(size>0) {
    decoded=CGImageSourceCreateThumbnailAtIndex(source,0,(__bridge CFDictionaryRef)@{(id)kCGImageSourceCreateThumbnailFromImageAlways:@YES,(id)kCGImageSourceCreateThumbnailWithTransform:@YES,(id)kCGImageSourceShouldCacheImmediately:@YES,(id)kCGImageSourceThumbnailMaxPixelSize:@(size)});
    if(decoded || size==1)break;
    size=MAX((NSUInteger)1,size/2); // Actual decoder/allocation failure: retry smaller.
  }
  CFRelease(source);
  if(!decoded)return nil;
  UIImage *image=[UIImage imageWithCGImage:decoded];CGImageRelease(decoded);return image;
}
static UIImage *EMDecodeOverlayAsset(NSString *name,NSUInteger dimension) {
  UIImage *image=[UIImage imageNamed:name];
  if(!image.CGImage)return nil;
  NSUInteger width=CGImageGetWidth(image.CGImage),height=CGImageGetHeight(image.CGImage);
  if(!width || !height)return nil;
  double scale=MIN(1.,(double)dimension/MAX(width,height));
  CGColorSpaceRef color=CGColorSpaceCreateDeviceRGB();
  CGContextRef context=NULL;
  NSUInteger w=0,h=0;
  while(scale>0) {
    w=MAX((NSUInteger)1,(NSUInteger)(width*scale));h=MAX((NSUInteger)1,(NSUInteger)(height*scale));
    context=CGBitmapContextCreate(NULL,w,h,8,0,color,kCGImageAlphaPremultipliedLast);
    if(context || (w==1 && h==1))break;
    scale/=2;
  }
  CGColorSpaceRelease(color);
  if(!context)return nil;
  CGContextDrawImage(context,CGRectMake(0,0,w,h),image.CGImage);
  CGImageRef decoded=CGBitmapContextCreateImage(context);CGContextRelease(context);
  if(!decoded)return nil;
  UIImage *result=[UIImage imageWithCGImage:decoded scale:1 orientation:image.imageOrientation];CGImageRelease(decoded);return result;
}

@interface EMOverlayImageJob : NSObject
@property(atomic) BOOL cancelled;
@property(atomic,strong) NSURLSessionTask *task;
@property(atomic,strong) NSURLSession *session;
@property(nonatomic,strong) NSOperationQueue *queue;
@property(nonatomic,strong) NSArray<NSString *> *uris;
@property(nonatomic,strong) NSMutableDictionary<NSString *,UIImage *> *images;
@property(nonatomic) NSUInteger index;
@property(nonatomic) NSUInteger dimension;
@property(nonatomic,copy) void (^completion)(NSDictionary *,NSString *);
- (void)next;
- (void)cancel;
@end
@implementation EMOverlayImageJob
- (void)cancel { @synchronized(self) { self.cancelled=YES;NSURLSessionTask *task=self.task;self.task=nil;[task cancel];NSURLSession *session=self.session;self.session=nil;[session invalidateAndCancel]; } }
- (void)finish:(NSString *)error {
  if(self.cancelled)return;
  NSDictionary *images=error?nil:[self.images copy];
  self.images=nil;self.uris=nil; // Release failed/unaccepted candidates after callback transfer.
  void (^completion)(NSDictionary *,NSString *)=self.completion;self.completion=nil;
  [self.session finishTasksAndInvalidate];self.session=nil;self.task=nil;
  if(completion)dispatch_async(dispatch_get_main_queue(),^{if(!self.cancelled)completion(images,error);});
}
- (void)accept:(UIImage *)image uri:(NSString *)uri {
  if(self.cancelled)return;
  if(!image){[self finish:@"Overlay image could not be decoded or allocated"];return;}
  self.images[uri]=image;[self.queue addOperationWithBlock:^{[self next];}];
}
- (void)next {
  @autoreleasepool {
    if(self.cancelled)return;
    while(self.index<self.uris.count && self.images[self.uris[self.index]])++self.index;
    if(self.index==self.uris.count){[self finish:nil];return;}
    NSString *uri=self.uris[self.index++];
    if(!self.dimension){[self finish:@"Overlay renderer texture capability is unavailable"];return;}
    if([uri rangeOfString:@":"].location==NSNotFound){[self accept:EMDecodeOverlayAsset(uri,self.dimension) uri:uri];return;}
    NSURL *url=[NSURL URLWithString:uri];
    if(url.isFileURL){[self accept:EMDecodeOverlayURL(url,self.dimension) uri:uri];return;}
    if(![@[@"http",@"https"] containsObject:url.scheme.lowercaseString]){[self finish:@"Unsupported Overlay image URL"];return;}
    // Task creation and invalidation share ownership: an atomic pointer alone
    // cannot prevent creating a task in an already invalidated URLSession.
    @synchronized(self) {
    if(self.cancelled)return;
    self.task=[self.session downloadTaskWithURL:url completionHandler:^(NSURL *file,NSURLResponse *response,NSError *error){
      if(self.cancelled)return;
      self.task=nil;
      NSInteger status=[response isKindOfClass:NSHTTPURLResponse.class]?((NSHTTPURLResponse *)response).statusCode:0;
      if(error || !file || status<200 || status>=300){[self finish:error?@"Overlay image download failed":[NSString stringWithFormat:@"Overlay image HTTP %ld",(long)status]];return;}
      // URLSession owns/removes this temporary file after the completion returns.
      [self accept:EMDecodeOverlayURL(file,self.dimension) uri:uri];
    }];
    [self.task resume];
    }
  }
}
@end
@implementation EMStagedOverlayImages {
  NSOperationQueue *_queue;
  EMOverlayImageJob *_job;
  BOOL _closed;
}
- (instancetype)init { if((self=[super init])){_queue=[NSOperationQueue new];_queue.maxConcurrentOperationCount=1;_queue.qualityOfService=NSQualityOfServiceUserInitiated;}return self; }
- (void)cancel { [_job cancel];_job=nil;[_queue cancelAllOperations]; }
- (void)close { _closed=YES;[self cancel]; }
- (void)loadURIs:(NSArray<NSString *> *)uris accepted:(NSDictionary<NSString *,UIImage *> *)accepted completion:(void (^)(NSDictionary<NSString *,UIImage *> *,NSString *))completion {
  [self cancel];if(_closed)return;
  EMOverlayImageJob *job=[EMOverlayImageJob new];_job=job;
  job.queue=_queue;job.uris=[[NSOrderedSet orderedSetWithArray:uris] array];job.images=[NSMutableDictionary new];
  for(NSString *uri in job.uris)if(accepted[uri])job.images[uri]=accepted[uri];
  job.completion=completion;
  job.session=[NSURLSession sessionWithConfiguration:NSURLSessionConfiguration.defaultSessionConfiguration delegate:nil delegateQueue:_queue];
  [_queue addOperationWithBlock:^{if(job.cancelled)return;job.dimension=EMOverlayTextureDimension();[job next];}];
}
- (void)dealloc { [self close]; }
@end
