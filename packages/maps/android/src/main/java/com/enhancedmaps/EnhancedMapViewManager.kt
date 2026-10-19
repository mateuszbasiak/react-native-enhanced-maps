package com.enhancedmaps

import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.ViewManagerDelegate
import com.facebook.react.uimanager.annotations.ReactProp
import com.facebook.react.viewmanagers.EnhancedMapViewManagerDelegate
import com.facebook.react.viewmanagers.EnhancedMapViewManagerInterface

class EnhancedMapViewManager : SimpleViewManager<EnhancedMapView>(), EnhancedMapViewManagerInterface<EnhancedMapView> {
  private val delegate = EnhancedMapViewManagerDelegate(this)
  override fun getDelegate(): ViewManagerDelegate<EnhancedMapView> = delegate
  override fun getName() = "EnhancedMapView"
  override fun createViewInstance(context: ThemedReactContext) = EnhancedMapView(context)
  override fun onAfterUpdateTransaction(view: EnhancedMapView) { super.onAfterUpdateTransaction(view); view.configure() }
  override fun onDropViewInstance(view: EnhancedMapView) { view.dispose(); super.onDropViewInstance(view) }
  @ReactProp(name = "cameraIdleEventsEnabled") override fun setCameraIdleEventsEnabled(view: EnhancedMapView, value: Boolean) { view.cameraIdleEventsEnabled = value }
  @ReactProp(name = "cameraEventsEnabled") override fun setCameraEventsEnabled(view: EnhancedMapView, value: Boolean) { view.cameraEventsEnabled = value }
  @ReactProp(name = "cameraEventIntervalMs", defaultDouble = 100.0) override fun setCameraEventIntervalMs(view: EnhancedMapView, value: Double) { view.cameraEventIntervalMs = if (value.isFinite()) value.coerceIn(16.0, 1000.0) else 100.0 }
  @ReactProp(name = "rasterOverlay") override fun setRasterOverlay(view: EnhancedMapView, value: String?) { view.setRasterOverlay(value ?: "") }
  @ReactProp(name = "provider") override fun setProvider(view: EnhancedMapView, value: String?) { view.provider = value ?: "google" }
  @ReactProp(name = "initialLatitude") override fun setInitialLatitude(view: EnhancedMapView, value: Double) { view.latitude = value }
  @ReactProp(name = "initialLongitude") override fun setInitialLongitude(view: EnhancedMapView, value: Double) { view.longitude = value }
  @ReactProp(name = "initialZoom", defaultDouble = 3.0) override fun setInitialZoom(view: EnhancedMapView, value: Double) { view.zoom = value }
  @ReactProp(name = "initialHeading") override fun setInitialHeading(view: EnhancedMapView, value: Double) { view.heading = value }
  @ReactProp(name = "initialPitch") override fun setInitialPitch(view: EnhancedMapView, value: Double) { view.pitch = value }
  override fun animateCamera(view: EnhancedMapView, latitude: Double, longitude: Double, zoom: Double, heading: Double, pitch: Double, durationMs: Double) { view.animateCamera(latitude, longitude, zoom, heading, pitch, durationMs) }
  override fun getExportedCustomDirectEventTypeConstants(): MutableMap<String, Any> = mutableMapOf(
    "topMapReady" to mapOf("registrationName" to "onMapReady"),
    "topMapError" to mapOf("registrationName" to "onMapError"),
    "topCameraIdle" to mapOf("registrationName" to "onCameraIdle"),
    "topCameraChange" to mapOf("registrationName" to "onCameraChange")
  )
}
