package com.enhancedmaps

import com.facebook.react.bridge.*
import org.json.JSONObject

internal object SharedOutputNative {
  init { System.loadLibrary("em_shader_layer") }
  @JvmStatic external fun create(size:Int):String
  @JvmStatic external fun acquire(key:String):Int
  @JvmStatic external fun publish(key:String,slot:Int):Boolean
  @JvmStatic external fun release(key:String)
  @JvmStatic external fun stats(key:String):String
  @JvmStatic external fun host(key:String,repaint:Runnable):Long
  @JvmStatic external fun install(runtime:Long)
  @JvmStatic external fun clear()
  @JvmStatic external fun totals():String
}

class ShaderLayerModule(context:ReactApplicationContext):ReactContextBaseJavaModule(context) {
  override fun invalidate() { SharedOutputNative.clear();super.invalidate() }
  override fun getName()="EMShaderLayer"
  @ReactMethod(isBlockingSynchronousMethod=true) fun install():Boolean {
    SharedOutputNative.install(reactApplicationContext.javaScriptContextHolder?.get() ?: 0L);return true
  }
  @ReactMethod(isBlockingSynchronousMethod=true) fun diagnostics():WritableMap {
    val s=JSONObject(SharedOutputNative.totals());return Arguments.createMap().apply {putInt("produced",s.getInt("produced"));putInt("sampled",s.getInt("sampled"));putInt("pools",s.getInt("pools"))}
  }
  private fun execute(promise:Promise,block:()->Any?) { try { promise.resolve(block()) }catch(e:Exception) { promise.reject("webgpu-prototype",e.message,e) } }
  @ReactMethod fun create(size:Double,promise:Promise)=execute(promise) {
    require(size==1024.0)
    Arguments.createMap().apply {
      val result=JSONObject(SharedOutputNative.create(size.toInt()))
      putString("id",result.getString("id"));putString("format",result.getString("format"));putInt("size",1024)
      putArray("handles",Arguments.createArray().apply { val handles=result.getJSONArray("handles");for(i in 0 until handles.length())pushString(handles.getString(i)) })
    }
  }
  @ReactMethod fun acquire(key:String,promise:Promise)=execute(promise) { SharedOutputNative.acquire(key) }
  @ReactMethod fun publish(key:String,slot:Double,promise:Promise)=execute(promise) { require(slot%1.0==0.0 && slot in 0.0..2.0);SharedOutputNative.publish(key,slot.toInt()) }
  @ReactMethod fun release(key:String,promise:Promise)=execute(promise) { SharedOutputNative.release(key);true }
  @ReactMethod fun stats(key:String,promise:Promise)=execute(promise) { val s=JSONObject(SharedOutputNative.stats(key));Arguments.createMap().apply { putInt("produced",s.getInt("produced"));putInt("sampled",s.getInt("sampled"));putInt("slots",3);putInt("bytes",s.getInt("bytes"));putString("error",s.getString("error")) } }
}
