#pragma once
#import <MapLibre/MapLibre.h>
#import "NativeClustering.h"

static NSString *EMMarkerClusterLayout(MLNMapView *map,NSString *scene,uint64_t index) {
  if(!scene || CGRectIsEmpty(map.bounds))return nil;
  NSDictionary *decoded=[NSJSONSerialization JSONObjectWithData:[scene dataUsingEncoding:NSUTF8StringEncoding] options:0 error:nil];
  NSDictionary *source=nil;
  for(NSDictionary *candidate in decoded[@"sources"])if([candidate[@"id"] isEqual:@"em-marker-clusters"]) { source=candidate;break; }
  if(!source || ![map.style layerWithIdentifier:@"em-marker-clusters-layout"])return nil;
  NSArray<id<MLNFeature>> *features=[map visibleFeaturesInRect:map.bounds inStyleLayersWithIdentifiers:[NSSet setWithObject:@"em-marker-clusters-layout"]];
  NSMutableDictionary<NSString *,NSDictionary *> *entries=[NSMutableDictionary new];
  for(id<MLNFeature> feature in features) {
    id stamp=feature.attributes[EMClusterIndexProperty];
    if(![stamp isKindOfClass:NSNumber.class] || [stamp doubleValue]!=(double)index || ![feature isKindOfClass:MLNPointFeature.class])return nil;
    CLLocationCoordinate2D coordinate=((MLNPointFeature *)feature).coordinate;
    NSString *identifier=[feature.identifier description];
    NSMutableDictionary *entry=[@{@"latitude":@(coordinate.latitude),@"longitude":@(std::remainder(coordinate.longitude,360.))} mutableCopy];
    if([feature conformsToProtocol:@protocol(MLNCluster)]) {
      id<MLNCluster> cluster=(id<MLNCluster>)feature;
      identifier=[NSString stringWithFormat:@"em-cluster:%lu",(unsigned long)cluster.clusterIdentifier];
      entry[@"clusterId"]=@(cluster.clusterIdentifier);entry[@"count"]=@(cluster.clusterPointCount);
    }
    if(!identifier.length)return nil;
    entry[@"id"]=identifier;entries[identifier]=entry;
    if(entries.count>10000)@throw [NSException exceptionWithName:@"MarkerClusterLayout" reason:@"Marker cluster layout limit exceeded" userInfo:nil];
  }
  NSMutableArray *ordered=[NSMutableArray new];
  for(NSString *key in [entries.allKeys sortedArrayUsingSelector:@selector(compare:)])[ordered addObject:entries[key]];
  NSData *json=[NSJSONSerialization dataWithJSONObject:@{@"sourceRevision":source[@"revision"],@"indexRevision":@(index),@"features":ordered} options:NSJSONWritingSortedKeys error:nil];
  if(!json || json.length>4*1024*1024)@throw [NSException exceptionWithName:@"MarkerClusterLayout" reason:@"Marker cluster layout exceeds 4 MiB" userInfo:nil];
  return [[NSString alloc] initWithData:json encoding:NSUTF8StringEncoding];
}
