#pragma once
#import <MapLibre/MapLibre.h>
static MLNImageSource *EMImageOverlaySource(NSDictionary *entry, UIImage *image) {
  NSArray *c=entry[@"coordinates"];
  auto corner=[&](NSUInteger i){return CLLocationCoordinate2DMake([c[i][1] doubleValue],[c[i][0] doubleValue]);};
  MLNCoordinateQuad quad=MLNCoordinateQuadMake(corner(0),corner(3),corner(2),corner(1));
  EMSceneRequire(image!=nil,@"Overlay image has not been staged");
  return [[MLNImageSource alloc] initWithIdentifier:entry[@"id"] coordinateQuad:quad image:image];
}
