package com.enhancedmaps

import android.content.pm.PackageManager
import android.widget.FrameLayout
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.LifecycleEventListener
import com.facebook.react.common.LifecycleState
import com.facebook.react.bridge.WritableMap
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.UIManagerHelper
import com.facebook.react.uimanager.events.Event
import com.google.android.gms.maps.CameraUpdateFactory
import com.google.android.gms.maps.GoogleMap
import com.google.android.gms.maps.MapView
import com.google.android.gms.maps.model.CameraPosition
import com.google.android.gms.maps.model.LatLng

class EnhancedMapView(private val reactContext: ThemedReactContext) : FrameLayout(reactContext), LifecycleEventListener {
  var latitude = 0.0
  var longitude = 0.0
  var zoom = 3.0
  var heading = 0.0
  var pitch = 0.0
  var provider = "google"
  private var nativeMap: MapView? = null
  private var map: GoogleMap? = null
  private var initialized = false
  private var disposed = false
  private var resumed = false
  private var origin = "unknown"

  fun configure() {
    if (initialized || disposed) return
    initialized = true
    if (provider != "google") { error("provider-unavailable", "Android supports Google Maps only"); return }
    val info = context.packageManager.getApplicationInfo(context.packageName, PackageManager.GET_META_DATA)
    val key = info.metaData?.getString("com.google.android.geo.API_KEY")
    if (key.isNullOrBlank()) { error("missing-api-key", "Configure com.google.android.geo.API_KEY in AndroidManifest.xml"); return }
    try {
      val view = MapView(reactContext)
      nativeMap = view
      addView(view, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT))
      view.onCreate(null)
      reactContext.addLifecycleEventListener(this)
      if (reactContext.lifecycleState == LifecycleState.RESUMED) onHostResume()
      view.getMapAsync { googleMap ->
        if (disposed) return@getMapAsync
        map = googleMap
        googleMap.setOnCameraMoveStartedListener { reason ->
          origin = when (reason) {
            GoogleMap.OnCameraMoveStartedListener.REASON_GESTURE -> "gesture"
            GoogleMap.OnCameraMoveStartedListener.REASON_DEVELOPER_ANIMATION -> "application"
            GoogleMap.OnCameraMoveStartedListener.REASON_API_ANIMATION -> "sdk"
            else -> "unknown"
          }
        }
        googleMap.setOnCameraMoveListener { emitCamera() }
        googleMap.setOnCameraIdleListener { emitCamera(); origin = "unknown" }
        animateCamera(latitude, longitude, zoom, heading, pitch, 0.0)
        // Map-loaded is stronger than getMapAsync: initialization does not prove tiles rendered.
        googleMap.setOnMapLoadedCallback { if (!disposed) emit("topMapReady", Arguments.createMap().apply { putString("provider", "google") }) }
      }
    } catch (_: Exception) {
      error("map-initialization", "Google Maps initialization failed; inspect native logs")
      dispose()
    }
  }
  fun animateCamera(lat: Double, lng: Double, z: Double, h: Double, p: Double, duration: Double) {
    if (disposed || listOf(lat, lng, z, h, p, duration).any { !it.isFinite() }) return
    val update = CameraUpdateFactory.newCameraPosition(CameraPosition(LatLng(lat, lng), z.toFloat(), p.coerceIn(0.0, 90.0).toFloat(), h.toFloat()))
    if (duration <= 0) map?.moveCamera(update)
    else map?.animateCamera(update, duration.coerceIn(1.0, Int.MAX_VALUE.toDouble()).toInt(), null)
  }
  private fun emitCamera() {
    val camera = map?.cameraPosition ?: return
    if (disposed) return
    emit("topCameraChange", Arguments.createMap().apply {
      putDouble("latitude", camera.target.latitude); putDouble("longitude", camera.target.longitude)
      putDouble("zoom", camera.zoom.toDouble()); putDouble("heading", camera.bearing.toDouble())
      putDouble("pitch", camera.tilt.toDouble()); putString("origin", origin)
    })
  }
  private fun error(code: String, message: String) { emit("topMapError", Arguments.createMap().apply { putString("code", code); putString("message", message) }) }
  private fun emit(name: String, data: WritableMap) {
    if (disposed) return
    UIManagerHelper.getEventDispatcherForReactTag(reactContext, id)?.dispatchEvent(MapEvent(UIManagerHelper.getSurfaceId(this), id, name, data))
  }
  override fun onHostResume() { if (!disposed && !resumed) { nativeMap?.onStart(); nativeMap?.onResume(); resumed = true } }
  override fun onHostPause() { if (resumed) { nativeMap?.onPause(); nativeMap?.onStop(); resumed = false } }
  override fun onHostDestroy() { dispose() }
  fun dispose() {
    if (disposed) return
    disposed = true
    reactContext.removeLifecycleEventListener(this)
    map?.setOnCameraMoveStartedListener(null); map?.setOnCameraMoveListener(null)
    map?.setOnCameraIdleListener(null); map?.setOnMapLoadedCallback(null)
    onHostPause()
    nativeMap?.onDestroy()
    removeAllViews()
    nativeMap = null; map = null
  }
  // FrameLayout can miss a layout request originating inside a Google map child.
  override fun requestLayout() {
    super.requestLayout()
    post { if (!disposed) { measure(MeasureSpec.makeMeasureSpec(width, MeasureSpec.EXACTLY), MeasureSpec.makeMeasureSpec(height, MeasureSpec.EXACTLY)); layout(left, top, right, bottom) } }
  }
}
private class MapEvent(surfaceId: Int, tag: Int, private val name: String, private val data: WritableMap) : Event<MapEvent>(surfaceId, tag) {
  override fun getEventName() = name
  override fun getEventData() = data
  override fun canCoalesce() = name == "topCameraChange"
}
