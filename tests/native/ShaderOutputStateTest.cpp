#include "ShaderOutputState.h"
#include <cassert>
int main() {
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
