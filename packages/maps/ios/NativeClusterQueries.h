#pragma once
#include <cmath>
#import <MapLibre/MapLibre.h>
#import "NativeClustering.h"

static void EMClusterQueryRequire(BOOL valid,NSString *message) {
  if(!valid)@throw [NSException exceptionWithName:@"ClusterQuery" reason:message userInfo:nil];
}
static NSDictionary *EMClusterQuery(MLNMapView *map,NSDictionary *request,uint64_t indexRevision,NSSet<NSString *> *sources) {
  auto integer=[&](NSString *key,double minimum,double maximum) {
    id raw=request[key];double value=[raw respondsToSelector:@selector(doubleValue)]?[raw doubleValue]:NAN;
    EMClusterQueryRequire([raw isKindOfClass:NSNumber.class] && CFGetTypeID((__bridge CFTypeRef)raw)!=CFBooleanGetTypeID() && std::isfinite(value) && std::floor(value)==value && value>=minimum && value<=maximum,@"Invalid cluster query number");
    return (NSUInteger)value;
  };
  EMClusterQueryRequire(integer(@"indexRevision",1,9007199254740991.)==indexRevision,@"Cluster index is obsolete");
  NSString *sourceID=request[@"sourceId"];
  EMClusterQueryRequire([sourceID isKindOfClass:NSString.class] && [sources containsObject:sourceID],@"Cluster source is unavailable");
  MLNSource *nativeSource=[map.style sourceWithIdentifier:sourceID];
  EMClusterQueryRequire([nativeSource isKindOfClass:MLNShapeSource.class],@"Cluster source is unavailable");
  MLNShapeSource *source=(MLNShapeSource *)nativeSource;
  NSUInteger clusterID=integer(@"clusterId",0,UINT32_MAX),count=integer(@"pointCount",2,9007199254740991.),limit=integer(@"limit",1,100),offset=integer(@"offset",0,9007199254740991.);
  MLNPointFeatureCluster *cluster=[MLNPointFeatureCluster new];
  cluster.coordinate=CLLocationCoordinate2DMake(0,0);
  cluster.attributes=@{@"cluster":@YES,@"cluster_id":@(clusterID),@"point_count":@(count)};
  NSString *kind=request[@"kind"];
  if([kind isEqual:@"clusterExpansion"]) {
    double zoom=[source zoomLevelForExpandingCluster:cluster];
    EMClusterQueryRequire(std::isfinite(zoom) && zoom>=0 && zoom<=25.5,@"Invalid cluster expansion zoom");
    return @{@"zoom":@(zoom)};
  }
  BOOL children=[kind isEqual:@"clusterChildren"];
  NSArray<id<MLNFeature>> *all=children?[source childrenOfCluster:cluster]:[source leavesOfCluster:cluster offset:offset limit:limit];
  EMClusterQueryRequire(all!=nil,@"Invalid cluster child count");
  NSUInteger start=children?MIN(offset,all.count):0,length=children?MIN(limit,all.count-start):all.count;
  EMClusterQueryRequire(length<=limit,@"Cluster page limit exceeded");
  NSMutableArray *features=[NSMutableArray new];
  for(NSUInteger i=start;i<start+length;++i) {
    id<MLNFeature> feature=all[i];
    EMClusterQueryRequire([feature isKindOfClass:MLNPointFeature.class],@"Invalid cluster point geometry");
    CLLocationCoordinate2D coordinate=((MLNPointFeature *)feature).coordinate;
    NSMutableDictionary *properties=[feature.attributes mutableCopy]?:[NSMutableDictionary new];
    id stamp=properties[EMClusterIndexProperty];
    EMClusterQueryRequire([stamp isKindOfClass:NSNumber.class] && [stamp doubleValue]==(double)indexRevision,@"Cluster feature belongs to an obsolete index");
    [properties removeObjectForKey:EMClusterIndexProperty];
    NSString *identifier=[feature.identifier description];
    if([feature conformsToProtocol:@protocol(MLNCluster)]) {
      id<MLNCluster> child=(id<MLNCluster>)feature;
      identifier=[NSString stringWithFormat:@"cluster:%lu",(unsigned long)child.clusterIdentifier];
      properties[@"cluster"]=@YES;properties[@"cluster_id"]=@(child.clusterIdentifier);properties[@"point_count"]=@(child.clusterPointCount);
    }
    EMClusterQueryRequire(identifier.length>0,@"Cluster point ID is missing");
    [features addObject:@{@"featureId":identifier,@"latitude":@(coordinate.latitude),@"longitude":@(coordinate.longitude),@"properties":properties}];
  }
  NSDictionary *result=@{@"sourceId":sourceID,@"indexRevision":@(indexRevision),@"total":@(children?all.count:count),@"offset":@(offset),@"features":features};
  NSData *encoded=[NSJSONSerialization dataWithJSONObject:result options:0 error:nil];
  EMClusterQueryRequire(encoded!=nil && encoded.length<=262144,@"Cluster result exceeds 256KiB");
  return result;
}
