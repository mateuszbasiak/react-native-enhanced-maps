#pragma once
#include <cmath>
#import <MapLibre/MapLibre.h>

static NSString *const EMClusterIndexProperty=@"__enhanced_maps_cluster_index";
static void EMStampClusterShape(MLNShape *shape,uint64_t revision) {
  if([shape isKindOfClass:MLNShapeCollection.class]) {
    for(MLNShape *child in ((MLNShapeCollection *)shape).shapes)EMStampClusterShape(child,revision);
  } else if([shape conformsToProtocol:@protocol(MLNFeature)]) {
    id<MLNFeature> feature=(id<MLNFeature>)shape;
    NSMutableDictionary *attributes=[feature.attributes mutableCopy]?:[NSMutableDictionary new];
    attributes[EMClusterIndexProperty]=@(revision);feature.attributes=attributes;
  }
}
static NSDictionary *EMClusterOptions(NSDictionary *entry) {
  NSDictionary *cluster=entry[@"cluster"];
  if(!cluster)return @{};
  if(![cluster isKindOfClass:NSDictionary.class] || ![[NSSet setWithArray:cluster.allKeys] isEqualToSet:[NSSet setWithArray:@[@"radius",@"maxZoom",@"minPoints"]]])
    @throw [NSException exceptionWithName:@"Cluster" reason:@"Invalid cluster options" userInfo:nil];
  auto integer=[&](NSString *key,double minimum,double maximum) {
    id raw=cluster[key];double value=[raw respondsToSelector:@selector(doubleValue)]?[raw doubleValue]:NAN;
    if(![raw isKindOfClass:NSNumber.class] || CFGetTypeID((__bridge CFTypeRef)raw)==CFBooleanGetTypeID() || !std::isfinite(value) || std::floor(value)!=value || value<minimum || value>maximum)
      @throw [NSException exceptionWithName:@"Cluster" reason:@"Invalid cluster number" userInfo:nil];
    return @(value);
  };
  NSNumber *radius=integer(@"radius",1,512),*zoom=integer(@"maxZoom",0,17),*minimum=integer(@"minPoints",2,10000);
  NSArray *features=entry[@"data"][@"features"];
  if(features.count>10000)@throw [NSException exceptionWithName:@"Cluster" reason:@"Cluster source point limit exceeded" userInfo:nil];
  for(NSDictionary *feature in features) {
    if([feature[@"id"] isKindOfClass:NSString.class] && [feature[@"id"] hasPrefix:@"cluster:"])
      @throw [NSException exceptionWithName:@"Cluster" reason:@"Reserved cluster input ID" userInfo:nil];
    if(![feature[@"geometry"][@"type"] isEqual:@"Point"])
      @throw [NSException exceptionWithName:@"Cluster" reason:@"Clustered sources require Point features" userInfo:nil];
    id properties=feature[@"properties"];
    if([properties isKindOfClass:NSDictionary.class])for(NSString *key in @[@"cluster",@"cluster_id",@"point_count",@"point_count_abbreviated",EMClusterIndexProperty])
      if(properties[key])@throw [NSException exceptionWithName:@"Cluster" reason:@"Reserved cluster input property" userInfo:nil];
  }
  NSExpression *reduce=[NSExpression expressionWithFormat:@"max:({$featureAccumulated, __enhanced_maps_cluster_index})"];
  NSExpression *map=[NSExpression expressionForKeyPath:EMClusterIndexProperty];
  return @{MLNShapeSourceOptionClustered:@YES,MLNShapeSourceOptionClusterRadius:radius,MLNShapeSourceOptionMaximumZoomLevelForClustering:zoom,MLNShapeSourceOptionClusterMinPoints:minimum,MLNShapeSourceOptionClusterProperties:@{EMClusterIndexProperty:@[reduce,map]}};
}
