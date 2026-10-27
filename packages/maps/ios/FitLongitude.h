#pragma once
#include <cmath>
static inline bool EMFitLongitude(double longitude,bool acceptedGeometry,double &output) {
  if (!std::isfinite(longitude) || (!acceptedGeometry && std::abs(longitude)>180)) return false;
  // Accepted generated shapes can cross the dateline in continuous world copies.
  if (longitude>180 || longitude<-180) {
    longitude=std::fmod(longitude,360);
    if(longitude>180)longitude-=360;
    if(longitude<-180)longitude+=360;
  }
  output=longitude;
  return true;
}
