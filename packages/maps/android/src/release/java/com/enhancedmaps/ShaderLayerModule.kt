package com.enhancedmaps

import com.facebook.react.bridge.*

class ShaderLayerModule(context:ReactApplicationContext):ShaderLayerModuleBase(context) {
  // RN scans declared methods on this concrete class, so keep bridge exports here.
  @ReactMethod(isBlockingSynchronousMethod=true) override fun install()=super.install()
  @ReactMethod override fun create(width:Double,height:Double,promise:Promise)=super.create(width,height,promise)
  @ReactMethod override fun release(key:String,promise:Promise)=super.release(key,promise)
}
