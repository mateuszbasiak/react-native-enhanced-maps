#pragma once
#include <jsi/jsi.h>
#include "ShaderOutputState.h"
namespace enhancedmaps {
namespace jsi=facebook::jsi;
class ShaderPoolHandle:public jsi::HostObject {
 std::shared_ptr<ShaderOutputState> state;
public:
 explicit ShaderPoolHandle(std::shared_ptr<ShaderOutputState> s):state(std::move(s)){}
 std::vector<jsi::PropNameID> getPropertyNames(jsi::Runtime& rt)override { std::vector<jsi::PropNameID> names;for(auto n:{"acquire","publishViewport","setZoomRange","camera","stats"})names.push_back(jsi::PropNameID::forAscii(rt,n));return names; }
 jsi::Value get(jsi::Runtime& rt,const jsi::PropNameID& key)override {
  auto name=key.utf8(rt);if(name!="acquire" && name!="publishViewport" && name!="setZoomRange" && name!="camera" && name!="stats")return jsi::Value::undefined();auto s=state;
  return jsi::Function::createFromHostFunction(rt,key, (name=="publishViewport"||name=="setZoomRange")?2:0,[s,name](jsi::Runtime& r,const jsi::Value&,const jsi::Value* args,size_t count)->jsi::Value {
   try {
    if(name=="acquire")return jsi::Value(s->acquire());
    if(name=="setZoomRange") {
      if(count!=2)throw std::invalid_argument("Invalid zoom range");
      double limits[2]={-std::numeric_limits<double>::infinity(),std::numeric_limits<double>::infinity()};
      for(int i=0;i<2;i++)if(!args[i].isUndefined()){if(!args[i].isNumber()||!std::isfinite(args[i].asNumber()))throw std::invalid_argument("Invalid zoom range");limits[i]=args[i].asNumber();}
      s->setZoomRange(limits[0],limits[1]);return jsi::Value::undefined();
    }
    if(name=="publishViewport") {
      if(count!=2 || !args[0].isNumber() || !args[1].isObject() || !args[1].asObject(r).isArray(r))throw std::invalid_argument("Invalid viewport publication");
      auto a=args[1].asObject(r).asArray(r);if(a.size(r)!=27)throw std::invalid_argument("Invalid viewport camera");
      double v[27];for(int i=0;i<27;i++){auto n=a.getValueAtIndex(r,i);if(!n.isNumber()||!std::isfinite(n.asNumber()))throw std::invalid_argument("Invalid camera value");v[i]=n.asNumber();}
      double slot=args[0].asNumber();if(slot<0||slot>2||slot!=std::floor(slot))throw std::invalid_argument("Invalid slot");
      ShaderCamera c;c.valid=true;c.width=(int)v[5];c.height=(int)v[6];c.origin={v[7],v[8]};
      if(c.width<1||c.height<1||c.width>4096||c.height>4096||v[5]!=c.width||v[6]!=c.height)throw std::invalid_argument("Invalid viewport dimensions");
      for(int i=0;i<9;i++){c.forward[i]=v[9+i];c.inverse[i]=v[18+i];}
      return jsi::Value(s->publishViewport((int)slot,c));
    }
    std::lock_guard<std::mutex> lock(s->mutex);
    if(name=="camera") {
      if(s->closed)throw std::runtime_error("Shader pool closed");
      const auto& c=s->camera;if(!c.valid)return jsi::Array(r,0);
      jsi::Array a(r,27);for(int i=0;i<5;i++)a.setValueAtIndex(r,i,s->view[i]);
      a.setValueAtIndex(r,5,c.width);a.setValueAtIndex(r,6,c.height);a.setValueAtIndex(r,7,c.origin[0]);a.setValueAtIndex(r,8,c.origin[1]);
      for(int i=0;i<9;i++){a.setValueAtIndex(r,9+i,c.forward[i]);a.setValueAtIndex(r,18+i,c.inverse[i]);}return a;
    }
    if(name=="stats") {jsi::Object o(r);o.setProperty(r,"produced",(double)s->produced);o.setProperty(r,"sampled",(double)s->sampled);o.setProperty(r,"error",jsi::String::createFromUtf8(r,s->error));return o;}
    return jsi::Value::undefined();
   }catch(const std::exception& e){throw jsi::JSError(r,e.what());}
  });
 }
};
class ShaderBridgeHandle:public jsi::HostObject {
 std::function<std::shared_ptr<ShaderOutputState>(std::string)> lookup;
public:
 explicit ShaderBridgeHandle(decltype(lookup) fn):lookup(std::move(fn)){}
 jsi::Value get(jsi::Runtime& rt,const jsi::PropNameID& key)override {
  if(key.utf8(rt)!="open")return jsi::Value::undefined();auto fn=lookup;
  return jsi::Function::createFromHostFunction(rt,key,1,[fn](jsi::Runtime& r,const jsi::Value&,const jsi::Value* args,size_t count)->jsi::Value{
   try {if(count!=1 || !args[0].isString())throw std::invalid_argument("Missing pool id");return jsi::Object::createFromHostObject(r,std::make_shared<ShaderPoolHandle>(fn(args[0].asString(r).utf8(r))));}
   catch(const std::exception& e){throw jsi::JSError(r,e.what());}
  });
 }
};
inline void installShaderJSI(jsi::Runtime& rt,std::function<std::shared_ptr<ShaderOutputState>(std::string)> lookup) {
 rt.global().setProperty(rt,"__enhancedMapsShader",jsi::Object::createFromHostObject(rt,std::make_shared<ShaderBridgeHandle>(std::move(lookup))));
}
}
