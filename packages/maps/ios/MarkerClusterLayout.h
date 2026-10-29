#pragma once
#import <MapLibre/MapLibre.h>
#import "NativeClustering.h"

static NSDictionary *EMMarkerClusterLayout(MLNMapView *map,NSArray<NSDictionary *> *sources,uint64_t index,CGFloat markerExtent) {
  if(!sources.count || CGRectIsEmpty(map.bounds))return nil;
  NSNumber *sourceRevision=nil;
  NSMutableDictionary<NSString *,NSDictionary *> *entries=[NSMutableDictionary new];
  for(NSDictionary *source in sources) {
    NSString *sourceID=source[@"id"];
    if(![sourceID isEqual:@"em-marker-clusters"] && ![sourceID hasPrefix:@"em-marker-clusters:"])continue;
    NSString *suffix=[sourceID substringFromIndex:[@"em-marker-clusters" length]];
    NSString *layerID=[@"em-marker-clusters-layout" stringByAppendingString:suffix];
    if(![map.style layerWithIdentifier:layerID])return nil;
    if(sourceRevision && ![sourceRevision isEqual:source[@"revision"]])return nil;
    sourceRevision=source[@"revision"];
    // Query the spatial index with room for marker content, rather than
    // mounting every feature in every loaded tile. The bootstrap margin also
    // lets new markers mount and measure before their anchors enter the map.
    CGFloat padding=MAX(64,markerExtent);
    CGRect queryBounds=CGRectInset(map.bounds,-padding,-padding);
    NSArray<id<MLNFeature>> *features=[map visibleFeaturesInRect:queryBounds inStyleLayersWithIdentifiers:[NSSet setWithObject:layerID]];
    for(id<MLNFeature> feature in features) {
      id stamp=feature.attributes[EMClusterIndexProperty];
      if(![stamp isKindOfClass:NSNumber.class] || [stamp doubleValue]!=(double)index || ![feature isKindOfClass:MLNPointFeature.class])return nil;
      CLLocationCoordinate2D coordinate=((MLNPointFeature *)feature).coordinate;
      NSString *identifier=[feature.identifier description];
      NSMutableDictionary *entry=[@{@"sourceId":sourceID,@"latitude":@(coordinate.latitude),@"longitude":@(std::remainder(coordinate.longitude,360.))} mutableCopy];
      if([feature conformsToProtocol:@protocol(MLNCluster)]) {
        id<MLNCluster> cluster=(id<MLNCluster>)feature;
        identifier=[NSString stringWithFormat:@"em-cluster:%@%lu",suffix.length?[[suffix substringFromIndex:1] stringByAppendingString:@":"]:@"",(unsigned long)cluster.clusterIdentifier];
        entry[@"clusterId"]=@(cluster.clusterIdentifier);entry[@"count"]=@(cluster.clusterPointCount);
      }
      if(!identifier.length)return nil;
      entry[@"id"]=identifier;entries[identifier]=entry;
    }
  }
  if(!sourceRevision)return nil;
  return @{@"sourceRevision":sourceRevision,@"indexRevision":@(index),@"features":entries};
}

// Sort and encode only after the structured layout differs from the last event.
static NSString *EMMarkerClusterLayoutJSON(NSDictionary *layout) {
  NSDictionary *entries=layout[@"features"];
  NSMutableArray *ordered=[NSMutableArray new];
  for(NSString *key in [entries.allKeys sortedArrayUsingSelector:@selector(compare:)])[ordered addObject:entries[key]];
  NSData *json=[NSJSONSerialization dataWithJSONObject:@{@"sourceRevision":layout[@"sourceRevision"],@"indexRevision":layout[@"indexRevision"],@"features":ordered} options:NSJSONWritingSortedKeys error:nil];
  if(!json)@throw [NSException exceptionWithName:@"MarkerClusterLayout" reason:@"Invalid marker cluster layout" userInfo:nil];
  return [[NSString alloc] initWithData:json encoding:NSUTF8StringEncoding];
}
