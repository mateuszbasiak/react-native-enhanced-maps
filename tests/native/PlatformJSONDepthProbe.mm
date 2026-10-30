#import <Foundation/Foundation.h>
// Run inside an iOS simulator, not just the macOS host, to measure its actual parser.
int main() { @autoreleasepool {
  printf("os=%s\n", NSProcessInfo.processInfo.operatingSystemVersionString.UTF8String);
  for (NSString *kind in @[@"object", @"array", @"mixed"]) {
    for (NSNumber *raw in @[@64, @128, @256, @384, @511, @512, @513, @768, @1024]) {
      NSUInteger depth = raw.unsignedIntegerValue;
      NSMutableString *json = [NSMutableString new];
      for (NSUInteger i=0; i<depth; i++) {
        BOOL object = [kind isEqual:@"object"] || ([kind isEqual:@"mixed"] && i%2==0);
        [json appendString:object?@"{\"a\":" : @"["];
      }
      [json appendString:@"0"];
      for (NSUInteger i=depth; i>0; i--) {
        BOOL object = [kind isEqual:@"object"] || ([kind isEqual:@"mixed"] && (i-1)%2==0);
        [json appendString:object?@"}" : @"]"];
      }
      NSData *data = [json dataUsingEncoding:NSUTF8StringEncoding];
      NSError *error = nil;
      id value = [NSJSONSerialization JSONObjectWithData:data options:0 error:&error];
      NSString *reason = error.userInfo[NSDebugDescriptionErrorKey] ?: @"";
      printf("kind=%s depth=%lu bytes=%lu accepted=%s error=%ld reason=%s\n", kind.UTF8String,
        (unsigned long)depth, (unsigned long)data.length, value?"true":"false", (long)error.code, reason.UTF8String);
    }
  }
} return 0; }
