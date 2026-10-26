package com.enhancedmaps

import com.facebook.react.bridge.*
import org.json.JSONObject

class ShaderLayerModule(context:ReactApplicationContext):ShaderLayerModuleBase(context) {
  // RN scans declared methods on this concrete class, so keep bridge exports here.
  @ReactMethod(isBlockingSynchronousMethod=true) override fun install()=super.install()
  @ReactMethod override fun create(width:Double,height:Double,promise:Promise)=super.create(width,height,promise)
  @ReactMethod override fun release(key:String,promise:Promise)=super.release(key,promise)
  @ReactMethod(isBlockingSynchronousMethod=true) fun diagnostics():WritableMap {
    val s=JSONObject(SharedOutputNative.totals());return Arguments.createMap().apply {putInt("produced",s.getInt("produced"));putInt("sampled",s.getInt("sampled"));putInt("pools",s.getInt("pools"))}
  }
  @ReactMethod fun stats(key:String,promise:Promise)=debugExecute(promise) { val s=JSONObject(SharedOutputNative.stats(key));Arguments.createMap().apply { putInt("produced",s.getInt("produced"));putInt("sampled",s.getInt("sampled"));putInt("slots",3);putInt("bytes",s.getInt("bytes"));putString("error",s.getString("error")) } }
  private fun debugExecute(promise:Promise,block:()->Any?) { try { promise.resolve(block()) }catch(e:Exception) { promise.reject("shader-diagnostics",e.message,e) } }
}
