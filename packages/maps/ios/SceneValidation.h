#pragma once
#import <Foundation/Foundation.h>
#include <math.h>
static void EMSceneRequire(BOOL valid,NSString *message){if(!valid)@throw [NSException exceptionWithName:@"Scene" reason:message userInfo:nil];}
static NSString *EMSceneName(id value,NSUInteger maximum){
  EMSceneRequire([value isKindOfClass:NSString.class] && [value length]>0 && [value length]<=maximum,@"Invalid scene resource ID");
  NSCharacterSet *invalid=[[NSCharacterSet characterSetWithCharactersInString:@"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_.:-"] invertedSet];
  EMSceneRequire([value rangeOfCharacterFromSet:invalid].location==NSNotFound,@"Invalid scene resource ID");return value;
}
static NSUInteger EMSceneArray(id value,NSString *message){EMSceneRequire([value isKindOfClass:NSArray.class],message);return [value count];}
static double EMSceneNumber(id value,double minimum,double maximum){
  EMSceneRequire([value isKindOfClass:NSNumber.class] && CFGetTypeID((__bridge CFTypeRef)value)!=CFBooleanGetTypeID(),@"Invalid layer style number");
  double n=[value doubleValue];EMSceneRequire(isfinite(n) && n>=minimum && n<=maximum,@"Invalid layer style number");return n;
}
static void EMSceneStyle(id value,NSString *type){
  EMSceneRequire([value isKindOfClass:NSDictionary.class],@"Invalid layer style");
  NSArray *allowed=[type isEqual:@"circle"]?@[@"circleRadius",@"circleColor",@"circleOpacity"]:[type isEqual:@"fill"]?@[@"fillColor",@"fillOpacity"]:@[@"lineColor",@"lineWidth",@"lineOpacity",@"lineCap",@"lineJoin",@"lineMiterLimit",@"lineDasharray",@"lineGradient"];
  for(NSString *key in value){EMSceneRequire([allowed containsObject:key],@"Unsupported layer style");id v=value[key];
    if([key hasSuffix:@"Color"]){NSRegularExpression *pattern=[NSRegularExpression regularExpressionWithPattern:@"^#[A-Fa-f0-9]{6}([A-Fa-f0-9]{2})?\\z" options:0 error:nil];EMSceneRequire([v isKindOfClass:NSString.class] && [pattern numberOfMatchesInString:v options:0 range:NSMakeRange(0,[v length])]==1,@"Invalid layer color");}
    else if([key isEqual:@"lineCap"])EMSceneRequire([@[@"butt",@"round",@"square"] containsObject:v],@"Invalid line cap");
    else if([key isEqual:@"lineJoin"])EMSceneRequire([@[@"miter",@"round",@"bevel"] containsObject:v],@"Invalid line join");
    else if([key isEqual:@"lineDasharray"]){NSUInteger n=EMSceneArray(v,@"Invalid line dash pattern");EMSceneRequire(n>=2 && n<=32 && n%2==0,@"Invalid line dash pattern");for(id item in v)EMSceneRequire(EMSceneNumber(item,0,10000000)>0,@"Invalid line dash pattern");}
    else if([key isEqual:@"lineGradient"]){NSUInteger n=EMSceneArray(v,@"Invalid line gradient");EMSceneRequire([type isEqual:@"line"] && n>=2 && n<=10000,@"Invalid line gradient");double previous=-1;
      NSRegularExpression *pattern=[NSRegularExpression regularExpressionWithPattern:@"^#[A-Fa-f0-9]{6}([A-Fa-f0-9]{2})?\\z" options:0 error:nil];
      for(NSUInteger i=0;i<n;i++){id stop=v[i];EMSceneRequire(EMSceneArray(stop,@"Invalid line gradient")==2,@"Invalid line gradient");double offset=EMSceneNumber(stop[0],0,1);id color=stop[1];
        EMSceneRequire(offset>previous && (i!=0 || offset==0) && (i+1!=n || offset==1) && [color isKindOfClass:NSString.class] && [pattern numberOfMatchesInString:color options:0 range:NSMakeRange(0,[color length])]==1,@"Invalid line gradient");previous=offset;}
    }
    else EMSceneNumber(v,0,[key hasSuffix:@"Opacity"]?1:[key isEqual:@"lineMiterLimit"]?1000:256);
  }
}
static void EMValidateScene(id scene,NSSet<NSString *> *externalSources,NSSet<NSString *> *externalLayers){
  EMSceneRequire([scene isKindOfClass:NSDictionary.class],@"Invalid scene JSON");NSArray *sources=scene[@"sources"],*layers=scene[@"layers"];
  NSUInteger ns=EMSceneArray(sources,@"Invalid scene sources"),nl=EMSceneArray(layers,@"Invalid scene layers");EMSceneRequire(ns<=64 && nl<=128,@"Map scene resource limit exceeded");
  NSMutableDictionary *sourceMap=[NSMutableDictionary new];
  for(id s in sources){EMSceneRequire([s isKindOfClass:NSDictionary.class],@"Invalid scene source");NSString *identifier=EMSceneName(s[@"id"],128);EMSceneRequire(![externalSources containsObject:identifier],@"Scene source ID collides with existing style");EMSceneRequire(!sourceMap[identifier],@"Duplicate scene source ID");sourceMap[identifier]=s;EMSceneRequire(!s[@"type"] || [s[@"type"] isEqual:@"geojson"],@"Unsupported source type");}
  NSMutableSet *ids=[NSMutableSet new],*inserted=[externalLayers mutableCopy];
  for(id l in layers){EMSceneRequire([l isKindOfClass:NSDictionary.class],@"Invalid scene layer");NSString *identifier=EMSceneName(l[@"id"],135);EMSceneRequire(![externalLayers containsObject:identifier],@"Scene layer ID collides with existing style");EMSceneRequire(![ids containsObject:identifier],@"Duplicate scene layer ID");[ids addObject:identifier];
    NSString *type=l[@"type"];EMSceneRequire([@[@"circle",@"line",@"fill"] containsObject:type],@"Unsupported layer type");NSString *source=EMSceneName(l[@"source"],128);EMSceneRequire(sourceMap[source]!=nil,@"Layer references missing source");
    if(l[@"beforeId"]){NSString *before=EMSceneName(l[@"beforeId"],135);EMSceneRequire(![before isEqual:identifier] && [inserted containsObject:before],@"Invalid layer insertion reference");}
    for(NSString *key in @[@"visible",@"interactive"])if(l[key])EMSceneRequire(CFGetTypeID((__bridge CFTypeRef)l[key])==CFBooleanGetTypeID(),@"Invalid layer boolean");
    if(l[@"clusterFilter"]){EMSceneRequire([@[@"clusters",@"points"] containsObject:l[@"clusterFilter"]],@"Invalid cluster filter");EMSceneRequire([sourceMap[source][@"cluster"] isKindOfClass:NSDictionary.class],@"Cluster filter requires clustered source");}
    if(l[@"style"])EMSceneStyle(l[@"style"],type);[inserted addObject:identifier];
  }
}
