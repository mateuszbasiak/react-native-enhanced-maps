#pragma once
#import <MapLibre/MapLibre.h>
#import "NativeClustering.h"

static NSString *EMMarkerClusterLayout(MLNMapView *map,NSString *scene,uint64_t index) {
  if(!scene || CGRectIsEmpty(map.bounds))return nil;
  NSDictionary *decoded=[NSJSONSerialization JSONObjectWithData:[scene dataUsingEncoding:NSUTF8StringEncoding] options:0 error:nil];
  NSNumber *sourceRevision=nil;
  NSMutableDictionary<NSString *,NSDictionary *> *entries=[NSMutableDictionary new];
  for(NSDictionary *source in decoded[@"sources"]) {
    NSString *sourceID=source[@"id"];
    if(![sourceID isEqual:@"em-marker-clusters"] && ![sourceID hasPrefix:@"em-marker-clusters:"])continue;
    NSString *suffix=[sourceID substringFromIndex:[@"em-marker-clusters" length]];
    NSString *layerID=[@"em-marker-clusters-layout" stringByAppendingString:suffix];
    if(![map.style layerWithIdentifier:layerID])return nil;
    if(sourceRevision && ![sourceRevision isEqual:source[@"revision"]])return nil;
    sourceRevision=source[@"revision"];
    NSArray<id<MLNFeature>> *features=[map visibleFeaturesInRect:map.bounds inStyleLayersWithIdentifiers:[NSSet setWithObject:layerID]];
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
      if(entries.count>10000)@throw [NSException exceptionWithName:@"MarkerClusterLayout" reason:@"Marker cluster layout limit exceeded" userInfo:nil];
    }
  }
  if(!sourceRevision)return nil;
  NSMutableArray *ordered=[NSMutableArray new];
  for(NSString *key in [entries.allKeys sortedArrayUsingSelector:@selector(compare:)])[ordered addObject:entries[key]];
  NSData *json=[NSJSONSerialization dataWithJSONObject:@{@"sourceRevision":sourceRevision,@"indexRevision":@(index),@"features":ordered} options:NSJSONWritingSortedKeys error:nil];
  if(!json || json.length>4*1024*1024)@throw [NSException exceptionWithName:@"MarkerClusterLayout" reason:@"Marker cluster layout exceeds 4 MiB" userInfo:nil];
  return [[NSString alloc] initWithData:json encoding:NSUTF8StringEncoding];
}
