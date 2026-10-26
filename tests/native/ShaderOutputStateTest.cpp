#include "ShaderOutputState.h"
#include "ShaderAtlas.h"
#include <cassert>
int main() {
 using namespace enhancedmaps;
 assert(kShaderAtlasSize==1024 && kShaderTileSize==256 && kShaderTileInterior==252);
 assert(kShaderAtlasBytes==12*1024*1024);
 auto first=shaderAtlasUV(0,0),last=shaderAtlasUV(15,3);
 assert(first[0]==2.f/1024 && first[1]==2.f/1024);
 assert(last[0]==1022.f/1024 && last[1]==1022.f/1024);
 for(int tile=0;tile<16;tile++) {
   auto a=shaderAtlasUV(tile,0),b=shaderAtlasUV(tile,3);
   assert(b[0]-a[0]==252.f/1024 && b[1]-a[1]==252.f/1024);
 }

 enhancedmaps::ShaderOutputState s;
 int repaint=0;s.repaint=[&]{repaint++;};
 int a=s.acquire();assert(a>=0);assert(s.publish(a,{{0,0,0}}));assert(repaint==1);
 int reader;{std::lock_guard<std::mutex> lock(s.mutex);reader=s.slots.beginRead();assert(reader==a);assert(s.tiles[reader][0].x==0);}
 int b=s.acquire();assert(b!=a);s.publish(b,{{1,0,0}});
 {std::lock_guard<std::mutex> lock(s.mutex);assert(s.tiles[reader][0].x==0);s.slots.endRead(reader);}
 // Identity homography at zoom zero maps NDC [-1,1] to normalized [0,1].
 double m[16]={2./512,0,0,0,0,2./512,0,0,0,0,1,0,-1,-1,0,1};
 s.updateView(m,0);assert(s.view[0]==0 && s.view[1]==0 && s.view[2]==1 && s.view[3]==1);
 auto held=s.acquire();s.close();assert(s.acquire()==-1);assert(!s.publish(held,{{0,0,0}}));
 bool rejected=false;try{s.publish(0,std::vector<enhancedmaps::ShaderTile>(17));}catch(...){rejected=true;}assert(rejected);
}
