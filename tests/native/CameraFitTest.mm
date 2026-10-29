#include "NativeCameraFit.h"
#include <cassert>
@implementation MLNMapView
@end
int main(){@autoreleasepool {
 MLNMapView *map=[MLNMapView new];map.bounds={{1000,1000}};
 NSMutableArray *input=[NSMutableArray new];for(int i=0;i<2000;i++)[input addObject:@[@0,@1]];
 NSString *json=[[NSString alloc] initWithData:[NSJSONSerialization dataWithJSONObject:input options:0 error:nil] encoding:NSUTF8StringEncoding];
 NSMutableDictionary *request=[@{@"coordinatesJSON":json,@"top":@0,@"right":@0,@"bottom":@0,@"left":@0} mutableCopy];
 auto bounds=EMFitBounds(map,request,nil,@[]);assert(bounds.sw.latitude==0 && bounds.ne.longitude==1);
 request[@"coordinatesJSON"]=[@"" stringByPaddingToLength:65537 withString:@" " startingAtIndex:0];
 BOOL rejected=NO;@try{EMFitBounds(map,request,nil,@[]);}@catch(NSException *error){rejected=[error.reason containsString:@"byte limit"];}assert(rejected);
 request[@"coordinatesJSON"]=@"[]";rejected=NO;@try{EMFitBounds(map,request,nil,@[]);}@catch(NSException *error){rejected=YES;}assert(rejected);
}}
