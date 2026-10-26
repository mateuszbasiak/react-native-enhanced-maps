#pragma once
#import <MapLibre/MapLibre.h>
#include <cmath>

static NSExpression *EMLineGradientExpression(NSDictionary *entry,NSSet<NSString *> *metricSources) {
  id style=entry[@"style"];
  if(![style isKindOfClass:NSDictionary.class] || !style[@"lineGradient"])return nil;
  id stops=style[@"lineGradient"];
  auto fail=[] { @throw [NSException exceptionWithName:@"LineGradient" reason:@"Invalid native line gradient" userInfo:nil]; };
  if(![entry[@"type"] isEqual:@"line"] || ![metricSources containsObject:entry[@"source"]] || style[@"lineDasharray"] || style[@"linePattern"] || ![stops isKindOfClass:NSArray.class] || [stops count]<2 || [stops count]>10000)fail();
  NSMutableDictionary *colors=[NSMutableDictionary dictionary];
  NSRegularExpression *colorPattern=[NSRegularExpression regularExpressionWithPattern:@"^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$" options:0 error:nil];
  double previous=-1;
  for(NSUInteger i=0;i<[stops count];i++) {
    id stop=stops[i];
    if(![stop isKindOfClass:NSArray.class] || [stop count]!=2)fail();
    id raw=stop[0],color=stop[1];
    if(![raw isKindOfClass:NSNumber.class] || CFGetTypeID((__bridge CFTypeRef)raw)==CFBooleanGetTypeID())fail();
    double offset=[raw doubleValue];
    if(!std::isfinite(offset) || offset<0 || offset>1 || offset<=previous || (i==0 && offset!=0) || (i+1==[stops count] && offset!=1))fail();
    if(![color isKindOfClass:NSString.class] || [colorPattern numberOfMatchesInString:color options:0 range:NSMakeRange(0,[color length])]!=1)fail();
    unsigned int value=0;
    [[NSScanner scannerWithString:[color substringFromIndex:1]] scanHexInt:&value];
    BOOL alpha=[color length]==9;
    colors[raw]=[UIColor colorWithRed:((value>>(alpha?24:16))&255)/255. green:((value>>(alpha?16:8))&255)/255. blue:((value>>(alpha?8:0))&255)/255. alpha:alpha?(value&255)/255.:1];
    previous=offset;
  }
  return [NSExpression mgl_expressionForInterpolatingExpression:NSExpression.lineProgressVariableExpression withCurveType:MLNExpressionInterpolationModeLinear parameters:nil stops:[NSExpression expressionForConstantValue:colors]];
}
