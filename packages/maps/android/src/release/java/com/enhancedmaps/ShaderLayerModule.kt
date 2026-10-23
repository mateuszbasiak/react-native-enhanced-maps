package com.enhancedmaps

import com.facebook.react.bridge.*

class ShaderLayerModule(context:ReactApplicationContext):ShaderLayerModuleBase(context) {
  // RN scans declared methods on this concrete class, so keep bridge exports here.
  @ReactMethod(isBlockingSynchronousMethod=true) override fun install()=super.install()
  @ReactMethod override fun create(size:Double,promise:Promise)=super.create(size,promise)
  @ReactMethod override fun acquire(key:String,promise:Promise)=super.acquire(key,promise)
  @ReactMethod override fun publish(key:String,slot:Double,promise:Promise)=super.publish(key,slot,promise)
  @ReactMethod override fun release(key:String,promise:Promise)=super.release(key,promise)
}
