#import <Foundation/Foundation.h>
#import "GeoJSONValidation.h"
#include <math.h>
int main(int argc,const char **argv) { @autoreleasepool {
  if(argc!=2)return 2;
  NSArray *fixtures=[NSJSONSerialization JSONObjectWithData:[NSData dataWithContentsOfFile:@(argv[1])] options:0 error:nil];
  if(![fixtures isKindOfClass:NSArray.class] || fixtures.count==0)return 2;
  for(NSDictionary *fixture in fixtures) {
    BOOL accepted=NO;NSUInteger positions=0;
    @try { positions=EMValidateGeoJSON(fixture[@"data"],[fixture[@"generatedShape"] boolValue]);accepted=YES; }
    @catch(NSException *error) {if(error.reason.length==0)return 3;}
    id expected=fixture[@"positions"];
    if((expected!=NSNull.null)!=accepted || (accepted && positions!=[expected unsignedIntegerValue])) {
      fprintf(stderr,"Unexpected validation result: %s\n",[fixture[@"label"] UTF8String]);return 1;
    }
  }
  for(NSNumber *invalid in @[@(NAN),@(INFINITY),@(-INFINITY)]) {
    NSDictionary *data=@{@"type":@"FeatureCollection",@"features":@[@{@"type":@"Feature",@"id":@"nonfinite",@"properties":NSNull.null,@"geometry":@{@"type":@"Point",@"coordinates":@[invalid,@0]}}]};
    BOOL rejected=NO;@try { EMValidateGeoJSON(data,NO); }@catch(NSException *error) {rejected=YES;}
    if(!rejected)return 4;
  }
  printf("Foundation GeoJSON validation: %lu shared fixtures and nonfinite axes\n",(unsigned long)fixtures.count);
  return 0;
}}
