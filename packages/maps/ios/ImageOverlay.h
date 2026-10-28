#pragma once
#import <MapLibre/MapLibre.h>
static MLNImageSource *EMImageOverlaySource(NSDictionary *entry) {
  NSArray *c=entry[@"coordinates"];
  auto corner=[&](NSUInteger i){return CLLocationCoordinate2DMake([c[i][1] doubleValue],[c[i][0] doubleValue]);};
  MLNCoordinateQuad quad=MLNCoordinateQuadMake(corner(0),corner(3),corner(2),corner(1));
  NSString *uri=entry[@"uri"];
  if([uri rangeOfString:@":"].location==NSNotFound) {
    UIImage *image=[UIImage imageNamed:uri];
    EMSceneRequire(image!=nil,@"Overlay image resource was not found");
    return [[MLNImageSource alloc] initWithIdentifier:entry[@"id"] coordinateQuad:quad image:image];
  }
  EMSceneRequire(![uri hasPrefix:@"asset:"],@"Android asset overlays are unavailable on iOS");
  NSURL *url=[NSURL URLWithString:uri];EMSceneRequire(url!=nil,@"Invalid Overlay image URL");
  return [[MLNImageSource alloc] initWithIdentifier:entry[@"id"] coordinateQuad:quad URL:url];
}
