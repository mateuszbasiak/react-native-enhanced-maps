#pragma once
#import <MapLibre/MapLibre.h>

// The private feature schema is validated before SDK construction.
static void EMApplyShapeBatch(MLNStyleLayer *layer,NSDictionary *entry) {
  if(!entry[@"shapeGroup"])return;
  NSPredicate *visible=[NSPredicate predicateWithFormat:@"__shape_visible == YES"];
  NSExpression *order=[NSExpression expressionForKeyPath:@"__shape_order"];
  if([layer isKindOfClass:MLNFillStyleLayer.class]) {
    MLNFillStyleLayer *fill=(MLNFillStyleLayer *)layer;
    fill.predicate=visible;fill.fillSortKey=order;
    fill.fillColor=[NSExpression expressionWithMLNJSONObject:@[@"to-color",@[@"get",@"__shape_fill"]]];
    fill.fillOpacity=[NSExpression expressionForKeyPath:@"__shape_opacity"];
  } else if([layer isKindOfClass:MLNLineStyleLayer.class]) {
    MLNLineStyleLayer *line=(MLNLineStyleLayer *)layer;
    line.predicate=[NSCompoundPredicate andPredicateWithSubpredicates:@[visible,[NSPredicate predicateWithFormat:@"__shape_line_group == %@",entry[@"shapeGroup"]]]];
    line.lineSortKey=order;
    line.lineColor=[NSExpression expressionWithMLNJSONObject:@[@"to-color",@[@"get",@"__shape_stroke"]]];
    line.lineWidth=[NSExpression expressionForKeyPath:@"__shape_width"];
    line.lineOpacity=[NSExpression expressionForKeyPath:@"__shape_opacity"];
  }
}
static NSArray<id<MLNFeature>> *EMShapeHitOrder(NSArray<id<MLNFeature>> *features) {
  // SDK query ordering differs by platform/tile. Resolve batch ties explicitly.
  if(!features.firstObject.attributes[@"__shape_order"])return features;
  return [features sortedArrayUsingComparator:^NSComparisonResult(id<MLNFeature> a,id<MLNFeature> b) {
    return [b.attributes[@"__shape_order"] compare:a.attributes[@"__shape_order"]];
  }];
}
