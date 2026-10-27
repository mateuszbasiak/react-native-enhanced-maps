#import <Foundation/Foundation.h>
#import <UIKit/UIKit.h>
#import <MapLibre/MapLibre.h>

NS_ASSUME_NONNULL_BEGIN
/** One bounded mounted-map snapshot. Retain until completion, then release. */
@interface EMMapSnapshot : NSObject
+ (instancetype)startWithMap:(MLNMapView *)map
                    markers:(NSArray<UIView *> *)markers
                    request:(NSDictionary *)request
                 completion:(void (^)(NSDictionary *_Nullable result, NSString *_Nullable error))completion;
- (void)cancel;
+ (void)discardResult:(NSDictionary *)result;
@end
NS_ASSUME_NONNULL_END
