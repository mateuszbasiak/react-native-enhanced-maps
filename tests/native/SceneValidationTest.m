#import "SceneValidation.h"
int main(int argc,const char **argv){@autoreleasepool {
  NSArray *fixtures=[NSJSONSerialization JSONObjectWithData:[NSData dataWithContentsOfFile:@(argv[1])] options:0 error:nil];
  if(!fixtures.count)return 2;
  for(NSDictionary *f in fixtures){BOOL accepted=YES;@try{EMValidateScene(f[@"scene"],[NSSet setWithArray:f[@"externalSources"]?:@[]],[NSSet setWithArray:f[@"externalLayers"]?:@[]]);}@catch(NSException *error){accepted=NO;}
    if(accepted!=[f[@"accepted"] boolValue]){fprintf(stderr,"Unexpected scene validation: %s\n",[f[@"label"] UTF8String]);return 1;}}
  return 0;
}}
