#import <Foundation/Foundation.h>
#import <UIKit/UIKit.h>
#import "../../packages/maps/ios/StagedOverlayImages.h"
static void require(BOOL value,NSString *message){if(!value){fprintf(stderr,"FAIL %s\n",message.UTF8String);exit(1);}}
static void waitFor(BOOL (^finished)(void)) {
  NSDate *deadline=[NSDate dateWithTimeIntervalSinceNow:20];
  while(!finished() && deadline.timeIntervalSinceNow>0)[NSRunLoop.mainRunLoop runUntilDate:[NSDate dateWithTimeIntervalSinceNow:.01]];
  require(finished(),@"native image loader timed out");
}
// Coordinate task creation against cancellation using a real Foundation session.
// The wrapper only supplies a scheduling barrier; URLSession still creates the task.
@interface EMRaceSession : NSObject
@property(nonatomic,strong) NSURLSession *session;
@property(nonatomic) dispatch_semaphore_t entered;
@property(nonatomic) dispatch_semaphore_t releaseCreation;
@property(atomic) BOOL invalidated;
- (NSURLSessionDownloadTask *)downloadTaskWithURL:(NSURL *)url completionHandler:(void (^)(NSURL *,NSURLResponse *,NSError *))completion;
- (void)invalidateAndCancel;
- (void)finishTasksAndInvalidate;
@end
@implementation EMRaceSession
- (NSURLSessionDownloadTask *)downloadTaskWithURL:(NSURL *)url completionHandler:(void (^)(NSURL *,NSURLResponse *,NSError *))completion {
  dispatch_semaphore_signal(self.entered);
  dispatch_semaphore_wait(self.releaseCreation,DISPATCH_TIME_FOREVER);
  return [self.session downloadTaskWithURL:url completionHandler:completion];
}
- (void)invalidateAndCancel { self.invalidated=YES;[self.session invalidateAndCancel]; }
- (void)finishTasksAndInvalidate { [self.session finishTasksAndInvalidate]; }
@end
@protocol EMOverlayJobTesting
@property(nonatomic,strong) NSURLSession *session;
@property(nonatomic,strong) NSOperationQueue *queue;
@property(nonatomic,strong) NSArray *uris;
@property(nonatomic,strong) NSMutableDictionary *images;
@property(nonatomic) NSUInteger dimension;
- (void)next;
- (void)cancel;
@end
static void cancellationRace(NSString *base) {
  EMRaceSession *session=[EMRaceSession new];
  session.session=[NSURLSession sessionWithConfiguration:NSURLSessionConfiguration.ephemeralSessionConfiguration];
  session.entered=dispatch_semaphore_create(0);session.releaseCreation=dispatch_semaphore_create(0);
  id<EMOverlayJobTesting> job=(id)[NSClassFromString(@"EMOverlayImageJob") new];
  require(job!=nil,@"image job missing");
  job.session=(NSURLSession *)session;job.queue=[NSOperationQueue new];job.queue.maxConcurrentOperationCount=1;
  job.uris=@[[base stringByAppendingString:@"/slow"]];job.images=[NSMutableDictionary new];job.dimension=8192;
  dispatch_group_t finished=dispatch_group_create();
  __block NSException *exception=nil;
  dispatch_group_async(finished,dispatch_get_global_queue(QOS_CLASS_USER_INITIATED,0),^{@try{[job next];}@catch(NSException *failure){exception=failure;}});
  require(dispatch_semaphore_wait(session.entered,dispatch_time(DISPATCH_TIME_NOW,5*NSEC_PER_SEC))==0,@"task creation barrier not reached");
  dispatch_semaphore_t cancelling=dispatch_semaphore_create(0);
  dispatch_group_async(finished,dispatch_get_global_queue(QOS_CLASS_USER_INITIATED,0),^{dispatch_semaphore_signal(cancelling);[job cancel];});
  require(dispatch_semaphore_wait(cancelling,dispatch_time(DISPATCH_TIME_NOW,5*NSEC_PER_SEC))==0,@"cancellation not attempted");
  // An unsafe implementation invalidates while task creation is paused here.
  NSDate *deadline=[NSDate dateWithTimeIntervalSinceNow:.25];
  while(!session.invalidated && deadline.timeIntervalSinceNow>0)[NSThread sleepForTimeInterval:.001];
  BOOL invalidatedDuringCreation=session.invalidated;
  dispatch_semaphore_signal(session.releaseCreation);
  require(dispatch_group_wait(finished,dispatch_time(DISPATCH_TIME_NOW,5*NSEC_PER_SEC))==0,@"creation/cancel deadlock");
  require(!invalidatedDuringCreation && exception==nil,@"session invalidated concurrently with task creation");
  printf("PASS cancellation serializes with real URLSession task creation\n");
}
int main(int argc,const char *argv[]){@autoreleasepool{
  require(argc==2,@"supply fixture server base URL");NSString *base=@(argv[1]);
  cancellationRace(base);
  EMStagedOverlayImages *loader=[EMStagedOverlayImages new];
  __block BOOL finished=NO;__block NSDictionary *accepted=nil;
  NSString *valid=[base stringByAppendingString:@"/image.png?variant=0"];
  [loader loadURIs:@[valid] accepted:@{} completion:^(NSDictionary *images,NSString *error){
    require(NSThread.isMainThread,@"callback must be on main");require(!error,@"valid image failed");
    require(CGImageGetWidth(((UIImage *)images[valid]).CGImage)==32,@"valid image width");accepted=images;finished=YES;
  }];waitFor(^BOOL{return finished;});printf("PASS valid decode and main completion\n");
  finished=NO;NSString *bad=[base stringByAppendingString:@"/missing.png"];
  [loader loadURIs:@[bad] accepted:accepted completion:^(NSDictionary *images,NSString *error){require(error!=nil && images==nil,@"HTTP failure must reject candidate");finished=YES;}];
  waitFor(^BOOL{return finished;});require([[loader valueForKey:@"job"] valueForKey:@"images"]==nil,@"failed candidates retained by loader");require(accepted[valid]!=nil,@"failure mutated accepted images");printf("PASS HTTP rejection preserves accepted cache\n");
  finished=NO;NSString *corrupt=[base stringByAppendingString:@"/corrupt"];
  [loader loadURIs:@[corrupt] accepted:accepted completion:^(NSDictionary *images,NSString *error){require(error!=nil && images==nil,@"corrupt image must reject");finished=YES;}];
  waitFor(^BOOL{return finished;});printf("PASS decode rejection\n");
  finished=NO;NSString *wide=[base stringByAppendingString:@"/wide.png"];
  [loader loadURIs:@[wide] accepted:accepted completion:^(NSDictionary *images,NSString *error){require(!error,@"oversized image failed");UIImage *image=images[wide];NSUInteger width=CGImageGetWidth(image.CGImage);require(width>0 && width<50000,@"oversized image not downsampled");printf("PASS GPU-family sampling width=%lu height=%lu\n",(unsigned long)width,(unsigned long)CGImageGetHeight(image.CGImage));finished=YES;}];waitFor(^BOOL{return finished;});
  NSString *slow=[base stringByAppendingString:@"/slow"];
  [loader loadURIs:@[slow] accepted:@{} completion:^(NSDictionary *images,NSString *error){require(NO,@"obsolete completion escaped cancellation");}];
  [NSRunLoop.mainRunLoop runUntilDate:[NSDate dateWithTimeIntervalSinceNow:.1]];
  finished=NO;
  [loader loadURIs:@[valid] accepted:accepted completion:^(NSDictionary *images,NSString *error){require(!error && images[valid]!=nil,@"recovery/cached replacement failed");finished=YES;}];
  waitFor(^BOOL{return finished;});
  [NSRunLoop.mainRunLoop runUntilDate:[NSDate dateWithTimeIntervalSinceNow:2]];
  printf("PASS latest replacement cancels obsolete network completion\n");
  [loader loadURIs:@[slow] accepted:@{} completion:^(NSDictionary *images,NSString *error){require(NO,@"closed loader delivered callback");}];
  [loader close];[NSRunLoop.mainRunLoop runUntilDate:[NSDate dateWithTimeIntervalSinceNow:2]];
  printf("PASS close suppresses completion\n");
}return 0;}
