#import <Foundation/Foundation.h>
#import "SnapshotResources.h"
int main(void) { @autoreleasepool {
  NSURL *base=[NSURL URLWithString:@"https://tiles.example.com/styles/liberty"];
  NSDictionary *cases=@{
    @"https://tiles.example.com/fonts/{fontstack}/{range}.pbf":@"https://tiles.example.com/fonts/{fontstack}/{range}.pbf",
    @"../fonts/{fontstack}/{range}.pbf":@"https://tiles.example.com/fonts/{fontstack}/{range}.pbf",
    @"tiles/%7Bliteral%7D/{z}/{x}/{y}.pbf":@"https://tiles.example.com/styles/tiles/%7Bliteral%7D/{z}/{x}/{y}.pbf",
    @"mapbox://sprites/example/{ratio}":@"mapbox://sprites/example/{ratio}"
  };
  for(NSString *value in cases) {NSString *actual=EMSnapshotResource(value,base);if(![actual isEqual:cases[value]]){NSLog(@"Unexpected resource: %@",actual);return 1;}}
  return 0;
}}
