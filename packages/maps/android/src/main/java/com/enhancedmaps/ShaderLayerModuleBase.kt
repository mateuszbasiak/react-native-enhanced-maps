package com.enhancedmaps

import com.facebook.react.bridge.*
import org.json.JSONObject

internal object SharedOutputNative {
  init { System.loadLibrary("em_shader_layer") }
  @JvmStatic external fun create(width:Int,height:Int):String
  @JvmStatic external fun release(key:String)
  @JvmStatic external fun stats(key:String):String
  @JvmStatic external fun host(key:String,repaint:Runnable):Long
  @JvmStatic external fun install(runtime:Long)
  @JvmStatic external fun clear()
  @JvmStatic external fun totals():String
}

open class ShaderLayerModuleBase(context:ReactApplicationContext):ReactContextBaseJavaModule(context) {
  override fun invalidate() { SharedOutputNative.clear();super.invalidate() }
  override fun getName()="EMShaderLayer"
  open fun install():Boolean {
    SharedOutputNative.install(reactApplicationContext.javaScriptContextHolder?.get() ?: 0L);return true
  }
  private fun execute(promise:Promise,block:()->Any?) { try { promise.resolve(block()) }catch(e:Exception) { promise.reject("webgpu-prototype",e.message,e) } }
  open fun create(width:Double,height:Double,promise:Promise)=execute(promise) {
    require(width%1.0==0.0 && height%1.0==0.0 && width in 1.0..4096.0 && height in 1.0..4096.0)
    Arguments.createMap().apply {
      val result=JSONObject(SharedOutputNative.create(width.toInt(),height.toInt()))
      putString("id",result.getString("id"));putString("format",result.getString("format"));putInt("size",result.getInt("size"));putInt("width",result.getInt("width"));putInt("height",result.getInt("height"))
      putArray("handles",Arguments.createArray().apply { val handles=result.getJSONArray("handles");for(i in 0 until handles.length())pushString(handles.getString(i)) })
    }
  }
  open fun release(key:String,promise:Promise)=execute(promise) { SharedOutputNative.release(key);true }

}
