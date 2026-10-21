package com.enhancedmaps

import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.ViewGroupManager
import com.facebook.react.uimanager.ViewManagerDelegate
import com.facebook.react.uimanager.annotations.ReactProp
import com.facebook.react.viewmanagers.EnhancedMarkerViewManagerDelegate
import com.facebook.react.viewmanagers.EnhancedMarkerViewManagerInterface

class EnhancedMarkerViewManager : ViewGroupManager<EnhancedMarkerView>(), EnhancedMarkerViewManagerInterface<EnhancedMarkerView> {
  private val delegate = EnhancedMarkerViewManagerDelegate(this)
  override fun getDelegate(): ViewManagerDelegate<EnhancedMarkerView> = delegate
  override fun getName() = "EnhancedMarkerView"
  override fun createViewInstance(context: ThemedReactContext) = EnhancedMarkerView(context)
  override fun onAfterUpdateTransaction(view: EnhancedMarkerView) { super.onAfterUpdateTransaction(view); view.owner?.markerChanged() }
  @ReactProp(name="markerID") override fun setMarkerID(view: EnhancedMarkerView, value: String?) { view.markerID = value ?: "" }
  @ReactProp(name="latitude") override fun setLatitude(view: EnhancedMarkerView, value: Double) { view.latitude = value }
  @ReactProp(name="longitude") override fun setLongitude(view: EnhancedMarkerView, value: Double) { view.longitude = value }
  @ReactProp(name="markerZIndex") override fun setMarkerZIndex(view: EnhancedMarkerView, value: Double) { view.markerZIndex = value }
  @ReactProp(name="anchorX", defaultDouble=.5) override fun setAnchorX(view: EnhancedMarkerView, value: Double) { view.anchorX = value.toFloat() }
  @ReactProp(name="anchorY", defaultDouble=1.0) override fun setAnchorY(view: EnhancedMarkerView, value: Double) { view.anchorY = value.toFloat() }
  @ReactProp(name="offsetX") override fun setOffsetX(view: EnhancedMarkerView, value: Double) { view.offsetX = (value * view.resources.displayMetrics.density).toFloat() }
  @ReactProp(name="offsetY") override fun setOffsetY(view: EnhancedMarkerView, value: Double) { view.offsetY = (value * view.resources.displayMetrics.density).toFloat() }
}
