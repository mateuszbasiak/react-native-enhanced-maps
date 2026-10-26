#pragma once
#include <array>
#include <cmath>
namespace enhancedmaps {
// Row-major ground-plane homographies; origin is retained as doubles on the CPU.
struct ShaderCamera {
 bool valid=false;
 int width=0,height=0;
 std::array<double,2> origin{};
 std::array<double,9> forward{},inverse{};
 std::array<double,3> project(double x,double y)const {
  x-=origin[0];y-=origin[1];
  return {forward[0]*x+forward[1]*y+forward[2],forward[3]*x+forward[4]*y+forward[5],forward[6]*x+forward[7]*y+forward[8]};
 }
 std::array<double,2> unproject(double x,double y)const {
  double w=inverse[6]*x+inverse[7]*y+inverse[8];
  return {origin[0]+(inverse[0]*x+inverse[1]*y+inverse[2])/w,origin[1]+(inverse[3]*x+inverse[4]*y+inverse[5])/w};
 }
};
inline bool shaderInverse(const std::array<double,9>& a,std::array<double,9>& out) {
 double d=a[0]*(a[4]*a[8]-a[5]*a[7])-a[1]*(a[3]*a[8]-a[5]*a[6])+a[2]*(a[3]*a[7]-a[4]*a[6]);
 if(!std::isfinite(d)||std::abs(d)<1e-30)return false;
 out={(a[4]*a[8]-a[5]*a[7])/d,(a[2]*a[7]-a[1]*a[8])/d,(a[1]*a[5]-a[2]*a[4])/d,
      (a[5]*a[6]-a[3]*a[8])/d,(a[0]*a[8]-a[2]*a[6])/d,(a[2]*a[3]-a[0]*a[5])/d,
      (a[3]*a[7]-a[4]*a[6])/d,(a[1]*a[6]-a[0]*a[7])/d,(a[0]*a[4]-a[1]*a[3])/d};
 return true;
}
inline ShaderCamera shaderCamera(const double* m,double zoom,int width,int height) {
 ShaderCamera c;if(width<1||height<1||width>4096||height>4096)return c;
 double world=512*std::pow(2,zoom);
 c.forward={m[0]*world,m[4]*world,m[12],m[1]*world,m[5]*world,m[13],m[3]*world,m[7]*world,m[15]};
 for(auto v:c.forward)if(!std::isfinite(v))return c;
 if(!shaderInverse(c.forward,c.inverse))return c;
 auto center=c.unproject(0,0);if(!std::isfinite(center[0])||!std::isfinite(center[1]))return c;
 // A binary-aligned origin survives the float32 WGSL handoff exactly.
 for(auto& v:center)v=std::round(v*65536.)/65536.;
 c.origin=center;
 for(int row=0;row<3;row++)c.forward[row*3+2]+=c.forward[row*3]*center[0]+c.forward[row*3+1]*center[1];
 double w=c.forward[8];if(w<=0)return c;
 for(auto& v:c.forward)v/=w;
 if(!shaderInverse(c.forward,c.inverse))return c;
 // Ground-plane output is undefined beyond the horizon. Do not publish such frames.
 for(double x:{-1.,1.})for(double y:{-1.,1.}){
  double w=c.inverse[6]*x+c.inverse[7]*y+c.inverse[8];if(w<=1e-12)return c;
 }
 c.width=width;c.height=height;c.valid=true;return c;
}
inline bool shaderViewportQuad(const ShaderCamera& source,const ShaderCamera& target,float* vertices) {
 if(!source.valid||!target.valid)return false;
 double dx=source.origin[0]-target.origin[0],dy=source.origin[1]-target.origin[1];
 dx-=std::round(dx);
 for(int i=0;i<4;i++) {
  double x=(i%2)*2.-1.,y=1.-(i/2)*2.;
  const auto& a=source.inverse;
  double w=a[6]*x+a[7]*y+a[8];
  double px=a[0]*x+a[1]*y+a[2]+dx*w,py=a[3]*x+a[4]*y+a[5]+dy*w;
  const auto& b=target.forward;
  double q[3]={b[0]*px+b[1]*py+b[2]*w,b[3]*px+b[4]*py+b[5]*w,b[6]*px+b[7]*py+b[8]*w};
  if(q[2]<=0||!std::isfinite(q[0])||!std::isfinite(q[1])||!std::isfinite(q[2]))return false;
  vertices[i*6]=(float)q[0];vertices[i*6+1]=(float)q[1];vertices[i*6+2]=0;vertices[i*6+3]=(float)q[2];
  vertices[i*6+4]=float(i%2);vertices[i*6+5]=float(i/2);
 }
 return true;
}
}
