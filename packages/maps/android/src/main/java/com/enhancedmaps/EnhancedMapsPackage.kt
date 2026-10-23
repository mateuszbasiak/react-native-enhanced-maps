package com.enhancedmaps

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class EnhancedMapsPackage : ReactPackage {
  override fun createNativeModules(context: ReactApplicationContext): List<NativeModule> = listOf(ShaderLayerModule(context))
  override fun createViewManagers(context: ReactApplicationContext): List<ViewManager<*, *>> = listOf(EnhancedMapLibreViewManager(), EnhancedMarkerViewManager())
}
