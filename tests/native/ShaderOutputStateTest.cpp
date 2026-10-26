#include "ShaderOutputState.h"
#include "ShaderCamera.h"
#include <cassert>
int main() {
 using namespace enhancedmaps;
 enhancedmaps::ShaderOutputState s;
 int repaint=0;s.repaint=[&]{repaint++;};
 // Identity homography at zoom zero maps NDC [-1,1] to normalized [0,1].
 double m[16]={2./512,0,0,0,0,2./512,0,0,0,0,1,0,-1,-1,0,1};
 s.updateView(m,0);assert(s.view[0]==0 && s.view[1]==0 && s.view[2]==1 && s.view[3]==1);

 // Viewport cameras project relative coordinates without losing high-zoom offsets.
 auto camera=shaderCamera(m,0,800,600);assert(camera.valid);
 auto point=camera.unproject(0.25,-0.5);
 auto clip=camera.project(point[0],point[1]);
 assert(std::abs(clip[0]/clip[2]-0.25)<1e-12 && std::abs(clip[1]/clip[2]+0.5)<1e-12);
 auto old=camera;int screenSlot=s.acquire();assert(s.publishViewport(screenSlot,old));
 {std::lock_guard<std::mutex> lock(s.mutex);assert(s.cameras[screenSlot].width==800);}
 int reader;{std::lock_guard<std::mutex> lock(s.mutex);reader=s.slots.beginRead();assert(reader==screenSlot);}
 auto changed=old;changed.width=900;auto next=s.acquire();assert(next!=reader);assert(s.publishViewport(next,changed));
 {std::lock_guard<std::mutex> lock(s.mutex);assert(s.cameras[reader].width==800);s.slots.endRead(reader);}
 double pitched[16]={1.8/512,0.3/512,0,0.2/512,-0.4/512,-1.5/512,0,0.4/512,0,0,1,0,-0.7,0.6,0,1};
 auto rotated=shaderCamera(pitched,0,1200,900);assert(rotated.valid);
 for(double x:{-0.8,0.,0.8})for(double y:{-0.8,0.,0.8}){
  auto p=rotated.unproject(x,y);auto q=rotated.project(p[0],p[1]);
  assert(std::abs(q[0]/q[2]-x)<1e-12 && std::abs(q[1]/q[2]-y)<1e-12);
 }
 float quad[24];assert(shaderViewportQuad(rotated,rotated,quad));
 for(int i=0;i<4;i++){assert(std::abs(quad[i*6]/quad[i*6+3]-(i%2*2-1))<1e-6);assert(std::abs(quad[i*6+1]/quad[i*6+3]-(1-i/2*2))<1e-6);}
 assert(!shaderCamera(m,0,0,600).valid);
 s.setZoomRange(8.5,18.0);
 assert(!s.isZoomVisible(8.49));assert(s.isZoomVisible(8.5));assert(s.isZoomVisible(17.999));assert(!s.isZoomVisible(18.0));assert(!s.isZoomVisible(20));
 auto held=s.acquire();s.close();assert(s.acquire()==-1);assert(!s.publishViewport(held,old));
 bool rejected=false;try{s.publishViewport(0,{});}catch(...){rejected=true;}assert(rejected);
}
