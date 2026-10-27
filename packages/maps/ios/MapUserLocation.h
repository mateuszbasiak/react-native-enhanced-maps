#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN
/** Foreground-only CoreLocation stream. Never requests location authorization. Main thread only. */
@interface EMMapUserLocation : NSObject
- (instancetype)initWithLocation:(void (^)(NSString *locationJSON))location
                          error:(void (^)(NSString *code, NSString *message))error;
- (void)configure:(BOOL)enabled;
- (void)pause;
- (void)resume;
- (void)close;
@end
NS_ASSUME_NONNULL_END
