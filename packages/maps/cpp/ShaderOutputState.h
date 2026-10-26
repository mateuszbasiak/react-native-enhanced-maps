#pragma once
#include "PrototypeOutputSlots.h"
#include "ShaderCamera.h"
#include <array>
#include <string>
#include <mutex>
#include <vector>
#include <functional>
#include <cmath>
#include <algorithm>
#include <stdexcept>
#include <limits>
namespace enhancedmaps {
struct ShaderOutputState {
  std::mutex mutex;
  PrototypeOutputSlots slots;
  std::array<ShaderCamera,3> cameras;
  ShaderCamera camera;
  std::array<double,5> view{0,0,1,1,0};
  std::function<void()> repaint;
  bool closed=false;
  unsigned produced=0,sampled=0;
  std::string error;
  double minZoom=-std::numeric_limits<double>::infinity(),maxZoom=std::numeric_limits<double>::infinity();
  void setZoomRange(double minimum,double maximum) {
    if(std::isnan(minimum)||std::isnan(maximum)||minimum>=maximum)throw std::invalid_argument("Invalid zoom range");
    std::function<void()> notify;
    {std::lock_guard<std::mutex> lock(mutex);minZoom=minimum;maxZoom=maximum;notify=repaint;}
    if(notify)notify();
  }
  bool isZoomVisible(double zoom) {std::lock_guard<std::mutex> lock(mutex);return zoom>=minZoom&&zoom<maxZoom;}

  void close() { std::lock_guard<std::mutex> lock(mutex);closed=true;slots.close();repaint=nullptr; }
  int acquire() { std::lock_guard<std::mutex> lock(mutex);return closed?-1:slots.acquire(); }
  bool publishViewport(int slot,const ShaderCamera& snapshot) {
    if(!snapshot.valid)throw std::invalid_argument("Invalid viewport camera");
    std::function<void()> notify;
    { std::lock_guard<std::mutex> lock(mutex);if(closed)return false;
      if(slot<0||slot>2)throw std::invalid_argument("Invalid slot");
      if(!slots.publish(slot))return false;
      cameras[slot]=snapshot;produced++;notify=repaint;
    }
    if(notify)notify();return true;
  }
  void updateView(const double* m,double zoom,int width=0,int height=0) {
    auto invalidateCamera=[&]{std::lock_guard<std::mutex> lock(mutex);camera={};};
    double world=512*std::pow(2,zoom),west=1e10,north=1e10,east=-1e10,south=-1e10;
    for(double nx:{-1.,0.,1.})for(double ny:{-1.,0.,1.}) {
      double a=m[0]-nx*m[3],b=m[4]-nx*m[7],c=nx*m[15]-m[12];
      double d=m[1]-ny*m[3],e=m[5]-ny*m[7],f=ny*m[15]-m[13],det=a*e-b*d;
      if(std::abs(det)<1e-15)continue;
      double x=(c*e-b*f)/det,y=(a*f-c*d)/det,w=m[3]*x+m[7]*y+m[15];
      if(w<=0 || !std::isfinite(x) || !std::isfinite(y))continue;
      west=std::min(west,x/world);east=std::max(east,x/world);north=std::min(north,y/world);south=std::max(south,y/world);
    }
    if(!(east>west && south>north)){invalidateCamera();return;}
    // Bound extreme horizon projections/world copies before publishing viewport coverage.
    double cx=(west+east)/2;west=std::max(west,cx-1.5);east=std::min(east,cx+1.5);
    north=std::max(0.,north);south=std::min(1.,south);
    if(!(south>north) || west< -3 || east>4){invalidateCamera();return;}
    std::lock_guard<std::mutex> lock(mutex);view={west,north,east,south,zoom};camera=shaderCamera(m,zoom,width,height);
  }
};
}
