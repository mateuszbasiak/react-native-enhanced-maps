#import <MapLibre/MapLibre.h>
#include <algorithm>
#include <vector>
#include <cmath>

static void EMFitRequire(BOOL valid,NSString *message) {
  if(!valid)@throw [NSException exceptionWithName:@"MapFit" reason:message userInfo:nil];
}
static void EMFitAdd(NSMutableArray *points,double latitude,double longitude) {
  EMFitRequire(std::isfinite(latitude) && std::isfinite(longitude) && std::abs(latitude)<=90 && std::abs(longitude)<=180,@"Invalid fit coordinate");
  EMFitRequire(points.count<100000,@"Too many fit positions");
  [points addObject:@[@(latitude),@(longitude)]];
}
static void EMFitGeometry(id value,NSMutableArray *points,int depth) {
  EMFitRequire(depth<=32,@"Fit geometry is too deep");
  if([value isKindOfClass:NSArray.class]) {
    NSArray *a=value;
    if(a.count>=2 && [a[0] isKindOfClass:NSNumber.class] && [a[1] isKindOfClass:NSNumber.class]) EMFitAdd(points,[a[1] doubleValue],[a[0] doubleValue]);
    else for(id item in a)EMFitGeometry(item,points,depth+1);
  } else if([value isKindOfClass:NSDictionary.class]) {
    NSDictionary *v=value;
    if([v[@"type"] isEqual:@"FeatureCollection"])EMFitGeometry(v[@"features"],points,depth+1);
    else if([v[@"type"] isEqual:@"Feature"])EMFitGeometry(v[@"geometry"],points,depth+1);
    else if([v[@"type"] isEqual:@"GeometryCollection"])EMFitGeometry(v[@"geometries"],points,depth+1);
    else if(v[@"coordinates"])EMFitGeometry(v[@"coordinates"],points,depth+1);
  }
}
static MLNCoordinateBounds EMFitBounds(MLNMapView *map,NSDictionary *request,NSString *acceptedScene,NSArray *markerPoints) {
  NSMutableArray *points=[NSMutableArray new];
  NSString *requestedCoordinates=request[@"coordinatesJSON"];
  EMFitRequire([requestedCoordinates isKindOfClass:NSString.class],@"Invalid fit coordinates");
  if(requestedCoordinates.length) {
    NSArray *input=[NSJSONSerialization JSONObjectWithData:[requestedCoordinates dataUsingEncoding:NSUTF8StringEncoding] options:0 error:nil];
    EMFitRequire([input isKindOfClass:NSArray.class] && input.count>=1 && input.count<=1000,@"Fit requires 1 to 1000 coordinates");
    for(NSArray *coordinate in input) {
      EMFitRequire([coordinate isKindOfClass:NSArray.class] && coordinate.count==2 && [coordinate[0] isKindOfClass:NSNumber.class] && [coordinate[1] isKindOfClass:NSNumber.class],@"Invalid fit coordinate");
      EMFitAdd(points,[coordinate[0] doubleValue],[coordinate[1] doubleValue]);
    }
  } else {
    if(acceptedScene) {
      NSDictionary *scene=[NSJSONSerialization JSONObjectWithData:[acceptedScene dataUsingEncoding:NSUTF8StringEncoding] options:0 error:nil];
      for(NSDictionary *source in scene[@"sources"])if(![request[@"markersOnly"] boolValue] || source[@"cluster"])EMFitGeometry(source[@"data"],points,0);
    }
    for(NSArray *coordinate in markerPoints)EMFitAdd(points,[coordinate[0] doubleValue],[coordinate[1] doubleValue]);
  }
  EMFitRequire(points.count>0,@"No map elements to fit");
  double edges[4]; NSArray *names=@[@"top",@"right",@"bottom",@"left"];
  for(int i=0;i<4;++i) { id v=request[names[i]]; EMFitRequire([v isKindOfClass:NSNumber.class],@"Invalid fit padding");edges[i]=[v doubleValue];EMFitRequire(std::isfinite(edges[i]) && edges[i]>=0 && edges[i]<=100000,@"Invalid fit padding"); }
  UIEdgeInsets content=map.contentInset;
  EMFitRequire(edges[1]+edges[3]+content.right+content.left<map.bounds.size.width && edges[0]+edges[2]+content.top+content.bottom<map.bounds.size.height,@"Fit padding leaves no viewport");
  double north=-90,south=90; std::vector<double> longitudes;
  for(NSArray *point in points) { double latitude=[point[0] doubleValue],longitude=[point[1] doubleValue];north=std::max(north,latitude);south=std::min(south,latitude);longitudes.push_back(std::fmod(longitude+360,360)); }
  std::sort(longitudes.begin(),longitudes.end());double gap=-1;size_t start=0;
  for(size_t i=0;i<longitudes.size();++i) {double next=i+1<longitudes.size()?longitudes[i+1]:longitudes[0]+360;if(next-longitudes[i]>gap){gap=next-longitudes[i];start=(i+1)%longitudes.size();}}
  double west=longitudes[start];if(west>180)west-=360;double east=west+360-gap;
  if(request[@"regionLongitude"]) {
    id centerValue=request[@"regionLongitude"],spanValue=request[@"regionLongitudeDelta"];
    EMFitRequire([centerValue isKindOfClass:NSNumber.class] && [spanValue isKindOfClass:NSNumber.class],@"Invalid region longitude span");
    double center=[centerValue doubleValue],span=[spanValue doubleValue];
    EMFitRequire(std::isfinite(center) && std::abs(center)<=180 && std::isfinite(span) && span>0 && span<=360,@"Invalid region longitude span");
    west=center-span/2;east=center+span/2;
  }
  return MLNCoordinateBoundsMake(CLLocationCoordinate2DMake(south,west),CLLocationCoordinate2DMake(north,east));
}
