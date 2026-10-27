package com.enhancedmaps

import android.view.View
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.ViewGroupManager
import com.facebook.react.uimanager.ViewManagerDelegate
import com.facebook.react.uimanager.annotations.ReactProp
import com.facebook.react.viewmanagers.EnhancedMapLibreViewManagerDelegate
import com.facebook.react.viewmanagers.EnhancedMapLibreViewManagerInterface

class EnhancedMapLibreViewManager : ViewGroupManager<EnhancedMapLibreView>(), EnhancedMapLibreViewManagerInterface<EnhancedMapLibreView> {
  private val delegate = EnhancedMapLibreViewManagerDelegate(this)
  override fun getDelegate(): ViewManagerDelegate<EnhancedMapLibreView> = delegate
  override fun getName() = "EnhancedMapLibreView"
  override fun createViewInstance(context: ThemedReactContext) = EnhancedMapLibreView(context)
  override fun onAfterUpdateTransaction(view: EnhancedMapLibreView) { super.onAfterUpdateTransaction(view); view.configure() }
  override fun onDropViewInstance(view: EnhancedMapLibreView) { view.dispose(); super.onDropViewInstance(view) }
  override fun addView(parent:EnhancedMapLibreView,child:View,index:Int) { require(child is EnhancedMarkerView) { "Map children must be Marker components" }; parent.addMarker(child,index) }
  override fun getChildCount(parent:EnhancedMapLibreView)=parent.markers.size
  override fun getChildAt(parent:EnhancedMapLibreView,index:Int):View=parent.markers[index]
  override fun removeViewAt(parent:EnhancedMapLibreView,index:Int) { parent.removeMarker(index) }
  @ReactProp(name="locationEnabled") override fun setLocationEnabled(view:EnhancedMapLibreView,value:Boolean){view.locationEnabled=value}
  @ReactProp(name="mapPaddingTop") override fun setMapPaddingTop(view:EnhancedMapLibreView,value:Double) { view.mapPaddingTop=value }
  @ReactProp(name="mapPaddingRight") override fun setMapPaddingRight(view:EnhancedMapLibreView,value:Double) { view.mapPaddingRight=value }
  @ReactProp(name="mapPaddingBottom") override fun setMapPaddingBottom(view:EnhancedMapLibreView,value:Double) { view.mapPaddingBottom=value }
  @ReactProp(name="mapPaddingLeft") override fun setMapPaddingLeft(view:EnhancedMapLibreView,value:Double) { view.mapPaddingLeft=value }
  @ReactProp(name="scrollEnabled",defaultBoolean=true) override fun setScrollEnabled(view:EnhancedMapLibreView,value:Boolean) { view.scrollEnabled=value }
  @ReactProp(name="zoomEnabled",defaultBoolean=true) override fun setZoomEnabled(view:EnhancedMapLibreView,value:Boolean) { view.zoomEnabled=value }
  @ReactProp(name="rotateEnabled",defaultBoolean=true) override fun setRotateEnabled(view:EnhancedMapLibreView,value:Boolean) { view.rotateEnabled=value }
  @ReactProp(name="pitchEnabled",defaultBoolean=true) override fun setPitchEnabled(view:EnhancedMapLibreView,value:Boolean) { view.pitchEnabled=value }
  @ReactProp(name="showsCompass",defaultBoolean=true) override fun setShowsCompass(view:EnhancedMapLibreView,value:Boolean) { view.showsCompass=value }
  @ReactProp(name="minZoomLevel",defaultDouble=0.0) override fun setMinZoomLevel(view:EnhancedMapLibreView,value:Double) { view.minZoomLevel=value }
  @ReactProp(name="maxZoomLevel",defaultDouble=24.0) override fun setMaxZoomLevel(view:EnhancedMapLibreView,value:Double) { view.maxZoomLevel=value }
  @ReactProp(name="styleURL") override fun setStyleURL(view:EnhancedMapLibreView,value:String?) { view.styleURL=value ?: "" }
  @ReactProp(name="styleRevision") override fun setStyleRevision(view:EnhancedMapLibreView,value:Double) { view.styleRevision=value }
  @ReactProp(name="mapPressEventsEnabled") override fun setMapPressEventsEnabled(view:EnhancedMapLibreView,value:Boolean) { view.mapPressEventsEnabled=value }
  @ReactProp(name="gestureEventsEnabled") override fun setGestureEventsEnabled(view:EnhancedMapLibreView,value:Boolean) { view.gestureEventsEnabled=value }
  @ReactProp(name="gestureSubscriptionRevision") override fun setGestureSubscriptionRevision(view:EnhancedMapLibreView,value:Double) { view.gestureSubscriptionRevision=value }
  @ReactProp(name="gestureEventIntervalMs",defaultDouble=50.0) override fun setGestureEventIntervalMs(view:EnhancedMapLibreView,value:Double) { view.gestureEventIntervalMs=value }
  @ReactProp(name="sceneJSON") override fun setSceneJSON(view:EnhancedMapLibreView,value:String?) { view.sceneJSON=value ?: "{\"sources\":[],\"layers\":[]}" }
  @ReactProp(name="textureMode") override fun setTextureMode(view:EnhancedMapLibreView,value:Boolean) { view.configureTextureMode(value) }
  @ReactProp(name="initialLatitude") override fun setInitialLatitude(view:EnhancedMapLibreView,value:Double) { view.latitude=value }
  @ReactProp(name="initialLongitude") override fun setInitialLongitude(view:EnhancedMapLibreView,value:Double) { view.longitude=value }
  @ReactProp(name="initialZoom",defaultDouble=3.0) override fun setInitialZoom(view:EnhancedMapLibreView,value:Double) { view.zoom=value }
  @ReactProp(name="initialHeading") override fun setInitialHeading(view:EnhancedMapLibreView,value:Double) { view.heading=value }
  @ReactProp(name="initialPitch") override fun setInitialPitch(view:EnhancedMapLibreView,value:Double) { view.pitch=value }
  override fun queryMap(view:EnhancedMapLibreView,requestId:Double,requestJSON:String?) { view.queryMap(requestId,requestJSON ?: "") }
  override fun animateCamera(view:EnhancedMapLibreView,latitude:Double,longitude:Double,zoom:Double,heading:Double,pitch:Double,durationMs:Double) { view.animateCamera(latitude,longitude,zoom,heading,pitch,durationMs) }
  @ReactProp(name="regionEventsEnabled")
  override fun setRegionEventsEnabled(view:EnhancedMapLibreView,value:Boolean) { view.regionEventsEnabled=value }
  override fun getExportedCustomDirectEventTypeConstants():MutableMap<String,Any> = mutableMapOf(
    "topUserLocation" to mapOf("registrationName" to "onUserLocation"),
    "topMapReady" to mapOf("registrationName" to "onMapReady"), "topMapError" to mapOf("registrationName" to "onMapError"),
    "topMapQueryResult" to mapOf("registrationName" to "onMapQueryResult"),
    "topMarkerClusters" to mapOf("registrationName" to "onMarkerClusters"),
    "topMapPress" to mapOf("registrationName" to "onMapPress"),
    "topGesture" to mapOf("registrationName" to "onGesture"),
    "topRegionEvent" to mapOf("registrationName" to "onRegionEvent"),
    "topCameraIdle" to mapOf("registrationName" to "onCameraIdle"), "topFeaturePress" to mapOf("registrationName" to "onFeaturePress")
  )
}
