#pragma once
#import <UIKit/UIKit.h>

@interface EMStagedOverlayImages : NSObject
- (void)loadURIs:(NSArray<NSString *> *)uris accepted:(NSDictionary<NSString *,UIImage *> *)accepted completion:(void (^)(NSDictionary<NSString *,UIImage *> *,NSString *))completion;
- (void)cancel;
- (void)close;
@end
