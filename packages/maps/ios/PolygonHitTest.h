#pragma once
#include <algorithm>
#include <cmath>
#include <limits>
#include <vector>

namespace enhancedmaps {
struct HitPoint { double longitude, latitude; };
using HitRing=std::vector<HitPoint>;
using HitPolygon=std::vector<HitRing>;
namespace polygon_hit_detail {
inline double y(double latitude) {
  constexpr double pi=3.14159265358979323846;
  const double clamped=std::clamp(latitude,-85.0511287798066,85.0511287798066);
  return std::log(std::tan(pi/4+clamped*pi/360));
}
inline bool valid(const HitRing& ring) {
  if(ring.size()<4)return false;
  for(const auto& p:ring)if(!std::isfinite(p.longitude) || !std::isfinite(p.latitude) || std::abs(p.latitude)>90)return false;
  return ring.front().longitude==ring.back().longitude && ring.front().latitude==ring.back().latitude;
}
inline bool contains(double longitude,double latitude,const HitRing& ring) {
  double west=std::numeric_limits<double>::infinity(),east=-west;
  for(const auto& p:ring){west=std::min(west,p.longitude);east=std::max(east,p.longitude);}
  const double min=std::ceil((west-longitude)/360),max=std::floor((east-longitude)/360);
  if(!std::isfinite(min) || !std::isfinite(max) || max-min>4096)return false;
  const auto copies=static_cast<int>(std::max(0.0,max-min+1));
  const double py=y(latitude);
  for(int world=0;world<copies;world++) {
    const double px=longitude+360*(min+world);
    bool inside=false;
    for(std::size_t i=1;i<ring.size();i++) {
      const double ax=ring[i-1].longitude,ay=y(ring[i-1].latitude),bx=ring[i].longitude,by=y(ring[i].latitude);
      const double cross=(px-ax)*(by-ay)-(py-ay)*(bx-ax);
      if(std::abs(cross)<1e-10 && px>=std::min(ax,bx)-1e-10 && px<=std::max(ax,bx)+1e-10 && py>=std::min(ay,by)-1e-10 && py<=std::max(ay,by)+1e-10)return true;
      if((ay>py)!=(by>py) && px<ax+(py-ay)*(bx-ax)/(by-ay))inside=!inside;
    }
    if(inside)return true;
  }
  return false;
}
}
inline bool containsFilledPolygon(double longitude,double latitude,const HitPolygon& rings) {
  if(!std::isfinite(longitude) || !std::isfinite(latitude) || std::abs(latitude)>90 || rings.empty())return false;
  for(const auto& ring:rings)if(!polygon_hit_detail::valid(ring))return false;
  if(!polygon_hit_detail::contains(longitude,latitude,rings.front()))return false;
  for(std::size_t i=1;i<rings.size();i++)if(polygon_hit_detail::contains(longitude,latitude,rings[i]))return false;
  return true;
}
}
