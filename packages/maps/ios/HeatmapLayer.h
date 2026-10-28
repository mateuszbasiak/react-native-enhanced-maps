#pragma once
#import <MapLibre/MapLibre.h>

// Values have passed SceneValidation; expressions are package-owned.
static MLNHeatmapStyleLayer *EMHeatmapLayer(NSString *identifier,MLNSource *source,NSDictionary *style) {
  NSMutableDictionary *colors=[NSMutableDictionary new];
  for(NSArray *stop in style[@"heatmapGradient"]) {
    NSString *hex=stop[1];unsigned int rgba=0;
    [[NSScanner scannerWithString:[hex substringFromIndex:1]] scanHexInt:&rgba];
    BOOL alpha=hex.length==9;
    colors[stop[0]]=[UIColor colorWithRed:((rgba>>(alpha?24:16))&255)/255. green:((rgba>>(alpha?16:8))&255)/255. blue:((rgba>>(alpha?8:0))&255)/255. alpha:alpha?(rgba&255)/255.:1];
  }
  MLNHeatmapStyleLayer *layer=[[MLNHeatmapStyleLayer alloc] initWithIdentifier:identifier source:source];
  layer.heatmapRadius=[NSExpression expressionForConstantValue:style[@"heatmapRadius"]];
  layer.heatmapOpacity=[NSExpression expressionForConstantValue:style[@"heatmapOpacity"]];
  layer.heatmapWeight=[NSExpression expressionForKeyPath:@"weight"];
  layer.heatmapColor=[NSExpression mgl_expressionForInterpolatingExpression:NSExpression.heatmapDensityVariableExpression withCurveType:MLNExpressionInterpolationModeLinear parameters:nil stops:[NSExpression expressionForConstantValue:colors]];
  return layer;
}
