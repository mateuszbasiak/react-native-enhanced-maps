#pragma once
#import <Foundation/Foundation.h>
#include <math.h>

static void EMGeoJSONRequire(BOOL condition,NSString *message) {
  if(!condition)@throw [NSException exceptionWithName:@"GeoJSON" reason:message userInfo:nil];
}
static NSUInteger EMGeoJSONArray(id value,NSString *message) {
  EMGeoJSONRequire([value isKindOfClass:NSArray.class],message);
  return [(NSArray *)value count];
}
static BOOL EMGeoJSONNumber(id value) {
  return [value isKindOfClass:NSNumber.class] && CFGetTypeID((__bridge CFTypeRef)value)!=CFBooleanGetTypeID();
}
static void EMGeoJSONPosition(id value,NSUInteger *positions,BOOL generatedShape) {
  EMGeoJSONRequire(EMGeoJSONArray(value,@"Invalid GeoJSON position")==2,@"GeoJSON position needs exactly two axes");
  NSArray *axes=value;
  EMGeoJSONRequire(EMGeoJSONNumber(axes[0]),@"GeoJSON longitude must be a number");
  EMGeoJSONRequire(EMGeoJSONNumber(axes[1]),@"GeoJSON latitude must be a number");
  double longitude=[axes[0] doubleValue],latitude=[axes[1] doubleValue];
  EMGeoJSONRequire(isfinite(longitude) && isfinite(latitude) && fabs(longitude)<=(generatedShape?1800000:180) && fabs(latitude)<=90,@"GeoJSON position is outside geographic bounds");
  EMGeoJSONRequire(*positions<(generatedShape?10000:50000),@"GeoJSON position limit exceeded");
  ++*positions;
}
static void EMGeoJSONLine(id value,BOOL ring,NSUInteger *positions,BOOL generatedShape) {
  NSUInteger length=EMGeoJSONArray(value,@"Invalid GeoJSON line or ring");
  EMGeoJSONRequire(length>=(ring?4:2),@"Invalid GeoJSON line or ring");
  NSArray *points=value;
  for(id point in points)EMGeoJSONPosition(point,positions,generatedShape);
  if(ring) {
    NSArray *first=points.firstObject,*last=points.lastObject;
    EMGeoJSONRequire([first[0] doubleValue]==[last[0] doubleValue] && [first[1] doubleValue]==[last[1] doubleValue],@"GeoJSON polygon rings must be closed");
  }
}
static void EMGeoJSONPolygon(id value,NSUInteger *positions,BOOL generatedShape) {
  EMGeoJSONRequire(EMGeoJSONArray(value,@"Invalid GeoJSON polygon")>0,@"GeoJSON polygon needs an exterior ring");
  for(id ring in (NSArray *)value)EMGeoJSONLine(ring,YES,positions,generatedShape);
}
static void EMGeoJSONGeometry(id value,NSUInteger *positions,BOOL generatedShape) {
  EMGeoJSONRequire([value isKindOfClass:NSDictionary.class],@"Expected GeoJSON geometry");
  NSDictionary *geometry=value;
  id type=geometry[@"type"],coordinates=geometry[@"coordinates"];
  EMGeoJSONRequire(!generatedShape || [@"LineString" isEqual:type] || [@"Polygon" isEqual:type],@"Generated shape requires line or polygon geometry");
  if([@"Point" isEqual:type])EMGeoJSONPosition(coordinates,positions,generatedShape);
  else if([@"LineString" isEqual:type])EMGeoJSONLine(coordinates,NO,positions,generatedShape);
  else if([@"Polygon" isEqual:type])EMGeoJSONPolygon(coordinates,positions,generatedShape);
  else {
    EMGeoJSONRequire([@[@"MultiPoint",@"MultiLineString",@"MultiPolygon"] containsObject:type?:NSNull.null],@"Unsupported GeoJSON geometry");
    EMGeoJSONArray(coordinates,@"Invalid GeoJSON multi-geometry");
    for(id part in (NSArray *)coordinates) {
      if([@"MultiPoint" isEqual:type])EMGeoJSONPosition(part,positions,generatedShape);
      else if([@"MultiLineString" isEqual:type])EMGeoJSONLine(part,NO,positions,generatedShape);
      else EMGeoJSONPolygon(part,positions,generatedShape);
    }
  }
}
/** Framing and geometry only: no normalization, SDK parsing or retained source data. */
static NSUInteger EMValidateGeoJSON(id value,BOOL generatedShape) {
  EMGeoJSONRequire([value isKindOfClass:NSDictionary.class] && [@"FeatureCollection" isEqual:((NSDictionary *)value)[@"type"]],@"Expected GeoJSON FeatureCollection");
  NSDictionary *data=value;
  id rawFeatures=data[@"features"];
  NSUInteger count=EMGeoJSONArray(rawFeatures,@"Expected GeoJSON features array");
  EMGeoJSONRequire(!generatedShape || count<=1,@"GeoJSON feature limit exceeded");
  NSMutableSet<NSString *> *ids=[NSMutableSet new];
  NSUInteger positions=0;
  for(id raw in (NSArray *)rawFeatures) {
    EMGeoJSONRequire([raw isKindOfClass:NSDictionary.class] && [@"Feature" isEqual:((NSDictionary *)raw)[@"type"]],@"Expected GeoJSON Feature");
    NSDictionary *feature=raw;
    id identifier=feature[@"id"];
    // Marker transport accepts arbitrary React-key paths and Unicode up to 512 UTF-16 units.
    EMGeoJSONRequire([identifier isKindOfClass:NSString.class] && [(NSString *)identifier length]>0 && [(NSString *)identifier length]<=512,@"Invalid GeoJSON feature ID");
    EMGeoJSONRequire(![ids containsObject:identifier],@"Duplicate GeoJSON feature ID");
    [ids addObject:identifier];
    id properties=feature[@"properties"];
    EMGeoJSONRequire(properties && (properties==NSNull.null || [properties isKindOfClass:NSDictionary.class]),@"GeoJSON properties must be an object or null");
    EMGeoJSONRequire(!generatedShape || ([@"geometry" isEqual:identifier] && properties==NSNull.null),@"Invalid generated shape feature");
    EMGeoJSONGeometry(feature[@"geometry"],&positions,generatedShape);
  }
  return positions;
}
