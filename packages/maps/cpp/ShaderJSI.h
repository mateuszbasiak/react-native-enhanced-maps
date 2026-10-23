#pragma once
#include <jsi/jsi.h>
#include "ShaderOutputState.h"
namespace enhancedmaps {
namespace jsi=facebook::jsi;
class ShaderPoolHandle:public jsi::HostObject {
 std::shared_ptr<ShaderOutputState> state;
public:
 explicit ShaderPoolHandle(std::shared_ptr<ShaderOutputState> s):state(std::move(s)){}
 std::vector<jsi::PropNameID> getPropertyNames(jsi::Runtime& rt)override { std::vector<jsi::PropNameID> names;for(auto n:{"acquire","publish","view","stats"})names.push_back(jsi::PropNameID::forAscii(rt,n));return names; }
 jsi::Value get(jsi::Runtime& rt,const jsi::PropNameID& key)override {
  auto name=key.utf8(rt);if(name!="acquire" && name!="publish" && name!="view" && name!="stats")return jsi::Value::undefined();auto s=state;
  return jsi::Function::createFromHostFunction(rt,key, name=="publish"?2:0,[s,name](jsi::Runtime& r,const jsi::Value&,const jsi::Value* args,size_t count)->jsi::Value {
   try {
    if(name=="acquire")return jsi::Value(s->acquire());
    if(name=="publish") {
      if(count!=2 || !args[0].isNumber() || !args[1].isObject() || !args[1].asObject(r).isArray(r))throw std::invalid_argument("Invalid shader publication");
      auto a=args[1].asObject(r).asArray(r);if(a.size(r)%3 || a.size(r)>48)throw std::invalid_argument("Invalid tile batch");
      std::vector<ShaderTile> batch;
      for(size_t i=0;i<a.size(r);i+=3) { int v[3];for(int j=0;j<3;j++){auto value=a.getValueAtIndex(r,i+j);if(!value.isNumber() || !std::isfinite(value.asNumber()) || std::floor(value.asNumber())!=value.asNumber() || std::abs(value.asNumber())>1048576)throw std::invalid_argument("Invalid tile coordinate");v[j]=(int)value.asNumber();}batch.push_back({v[0],v[1],v[2]}); }
      double slot=args[0].asNumber();if(!std::isfinite(slot) || slot!=std::floor(slot) || slot<0 || slot>2)throw std::invalid_argument("Invalid slot");
      return jsi::Value(s->publish((int)slot,std::move(batch)));
    }
    std::lock_guard<std::mutex> lock(s->mutex);
    if(name=="view") {if(s->closed)throw std::runtime_error("Shader pool closed");jsi::Array a(r,5);for(int i=0;i<5;i++)a.setValueAtIndex(r,i,s->view[i]);return a;}
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
