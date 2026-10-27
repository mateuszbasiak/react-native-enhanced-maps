package com.enhancedmaps

import android.view.Choreographer
import android.view.MotionEvent
import android.view.View
import android.view.accessibility.AccessibilityEvent
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.LifecycleEventListener
import com.facebook.react.bridge.WritableMap
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.UIManagerHelper
import com.facebook.react.uimanager.TouchTargetHelper
import com.facebook.react.uimanager.events.Event
import org.json.JSONObject
import org.maplibre.android.MapLibre
import org.maplibre.android.camera.CameraPosition
import org.maplibre.android.camera.CameraUpdateFactory
import org.maplibre.android.geometry.LatLng
import org.maplibre.android.gestures.*
import org.maplibre.android.maps.MapLibreMap
import org.maplibre.android.maps.MapLibreMapOptions
import org.maplibre.android.maps.MapView
import org.maplibre.android.maps.Style
import org.maplibre.android.maps.widgets.CompassView
import org.maplibre.android.style.layers.*
import org.maplibre.android.style.layers.PropertyFactory.*
import org.maplibre.android.style.sources.GeoJsonSource

private fun initialized(context: ThemedReactContext): ThemedReactContext { MapLibre.getInstance(context); return context }

class EnhancedMapLibreView(private val reactContext: ThemedReactContext) : MapView(initialized(reactContext), MapLibreMapOptions.createFromAttributes(reactContext)), LifecycleEventListener {
  private var snapshotOperation:MapSnapshot?=null
  private var snapshotGeneration=0L
  private fun cancelSnapshot(){snapshotGeneration++;snapshotOperation?.cancel();snapshotOperation=null}
  private val shaderLayerOwners=mutableMapOf<String,String>()
  var mapPaddingTop=0.0;var mapPaddingRight=0.0;var mapPaddingBottom=0.0;var mapPaddingLeft=0.0
  private var appliedMapPadding:IntArray?=null
  private var lastPaddingError:String?=null
  var scrollEnabled = true
  var zoomEnabled = true
  var rotateEnabled = true
  var pitchEnabled = true
  var showsCompass = true
  var minZoomLevel = 0.0
  var maxZoomLevel = 24.0
  var styleURL = ""
  var locationEnabled=false
  private val userLocation=MapUserLocation(reactContext,{json ->
    if(!disposed && isAttachedToWindow && readyStyleRevision==styleRevision && locationEnabled) emit("topUserLocation",Arguments.createMap().apply {putString("locationJSON",json);putString("error","");putDouble("styleRevision",readyStyleRevision)})
  },{code,message -> if(!disposed)error(code,message)})
  private fun updateLocationSource(){userLocation.configure(locationEnabled && readyStyleRevision==styleRevision && readyStyleRevision>=0)}
  var styleRevision = 0.0
  private var loadedStyleRevision: Double? = null
  private var readyStyleRevision = -1.0
  var mapPressEventsEnabled = false
  var gestureEventsEnabled = false
    set(value) { if(field != value) gestureEvents.reset(); field=value }
  var gestureSubscriptionRevision = 0.0
    set(value) { if(field != value) gestureEvents.reset(); field=value }
  var gestureEventIntervalMs = 50.0
  private val gestureEvents = GestureEventGate()
  private val gestureKinds = arrayOf("pan", "zoom", "rotate", "tilt")
  private val gesturePhases = arrayOf("begin", "update", "end", "cancel")
  var sceneJSON = "{\"sources\":[],\"layers\":[]}"
  var latitude = 0.0; var longitude = 0.0; var zoom = 3.0; var heading = 0.0; var pitch = 0.0
  val markers = mutableListOf<EnhancedMarkerView>()
  private val textures = mutableMapOf<EnhancedMarkerView, EMMarkerTexture>()
  private val markerGestures = MarkerGestureGate()
  private var lastCompletedRegionKey:String? = null
  private var lastMovingRegionKey:String? = null
  private var fitPreflight = false
  private var regionIsGesture = false
  private val cameraOrigins = CameraOriginTracker()
  private val touchCoordinates = FloatArray(2)
  private var map: MapLibreMap? = null
  private var loadedURL: String? = null
  private var appliedScene: String? = null
  private var acceptedScene: String? = null
  private var markerLayoutSources = emptyList<MarkerClusterLayout.Source>()
  private val sourceRevisions = SourceRevisionGate()
  private var styleGeneration = 0L
  private var sceneSources = listOf<String>()
  private var clusteredSources = setOf<String>()
  private var lastMarkerLayout: MarkerClusterLayout.Layout? = null
  private var clusterIndexRevision = 0L
  private var sceneLayers = listOf<String>()
  private val interactiveLayers = mutableSetOf<String>()
  private val layerSources = mutableMapOf<String,String>()
  private var orderDirty = true
  private var orderStyle: Style? = null
  private var disposed = false
  private var configured = false
  private var resumed = false
  private var framePending = false
  private var sdkLayoutPending = false
  private val clock = Choreographer.getInstance()
  private val frame = object : Choreographer.FrameCallback {
    override fun doFrame(time: Long) {
      framePending = false
      if (disposed || !isAttachedToWindow || markers.isEmpty()) return
      updatePositions()
      textures.values.forEach { it.update() }
      synchronizeOrder()
      scheduleFrame()
    }
  }
  override fun initialiseCompassView(): CompassView {
    val compass=super.initialiseCompassView()
    // Keep the SDK's click/animation handlers. View.performClick sends this native
    // activation signal after its click listener, before posted camera callbacks.
    // The delegate sees it even when accessibility services are disabled, and it
    // also covers accessibility/keyboard activation without inferring from deltas.
    compass.accessibilityDelegate=object : View.AccessibilityDelegate() {
      override fun sendAccessibilityEvent(host:View,eventType:Int) {
        if(eventType == AccessibilityEvent.TYPE_VIEW_CLICKED && !disposed) cameraOrigins.sdkControlActivated()
        super.sendAccessibilityEvent(host,eventType)
      }
    }
    return compass
  }
  init {
    clipChildren = false; clipToPadding = false
    onCreate(null)
    reactContext.addLifecycleEventListener(this)
    getMapAsync { nativeMap ->
      if (disposed) return@getMapAsync
      map = nativeMap
      nativeMap.addOnMoveListener(object : MapLibreMap.OnMoveListener {
        override fun onMoveBegin(detector: MoveGestureDetector) { observeGesture(0,0,detector) }
        override fun onMove(detector: MoveGestureDetector) { observeGesture(0,1,detector) }
        override fun onMoveEnd(detector: MoveGestureDetector) { observeGesture(0,2,detector) }
      })
      nativeMap.addOnScaleListener(object : MapLibreMap.OnScaleListener {
        override fun onScaleBegin(detector: StandardScaleGestureDetector) { observeGesture(1,0,detector) }
        override fun onScale(detector: StandardScaleGestureDetector) { observeGesture(1,1,detector) }
        override fun onScaleEnd(detector: StandardScaleGestureDetector) { observeGesture(1,2,detector) }
      })
      nativeMap.addOnRotateListener(object : MapLibreMap.OnRotateListener {
        override fun onRotateBegin(detector: RotateGestureDetector) { observeGesture(2,0,detector) }
        override fun onRotate(detector: RotateGestureDetector) { observeGesture(2,1,detector) }
        override fun onRotateEnd(detector: RotateGestureDetector) { observeGesture(2,2,detector) }
      })
      nativeMap.addOnShoveListener(object : MapLibreMap.OnShoveListener {
        override fun onShoveBegin(detector: ShoveGestureDetector) { observeGesture(3,0,detector) }
        override fun onShove(detector: ShoveGestureDetector) { observeGesture(3,1,detector) }
        override fun onShoveEnd(detector: ShoveGestureDetector) { observeGesture(3,2,detector) }
      })
      nativeMap.addOnCameraMoveStartedListener { reason ->
        regionIsGesture = reason == MapLibreMap.OnCameraMoveStartedListener.REASON_API_GESTURE
        cameraOrigins.begin(
          reason == MapLibreMap.OnCameraMoveStartedListener.REASON_API_GESTURE,
          reason == MapLibreMap.OnCameraMoveStartedListener.REASON_DEVELOPER_ANIMATION,
          reason == MapLibreMap.OnCameraMoveStartedListener.REASON_API_ANIMATION
        )
      }
      nativeMap.addOnCameraMoveListener { updatePositions(); emitRegionEvent(false) }
      nativeMap.addOnCameraIdleListener {
        updatePositions()
        emitRegionEvent(true)
        val camera = nativeMap.cameraPosition
        emit("topCameraIdle", Arguments.createMap().apply {
          putDouble("latitude", camera.target?.latitude ?: 0.0); putDouble("longitude", camera.target?.longitude ?: 0.0)
          putDouble("zoom", camera.zoom); putDouble("heading", camera.bearing); putDouble("pitch", camera.tilt)
          putString("origin", cameraOrigins.consumeIdle())
        })
      }
      nativeMap.addOnMapClickListener { coordinate ->
        val point = nativeMap.projection.toScreenLocation(coordinate)
        for (layer in (nativeMap.style?.layers ?: emptyList()).filter { it.id in interactiveLayers }.asReversed()) {
          val id=layer.id
          val feature = nativeMap.queryRenderedFeatures(point, id).firstOrNull {
            layer !is FillLayer || NativeFillHit.accepts(it.geometry(),coordinate.longitude,coordinate.latitude)
          } ?: continue
          val source = layerSources[id] ?: ""
          val properties=feature.properties()?.deepCopy() ?: com.google.gson.JsonObject()
          val stamp=if(source in clusteredSources)properties.remove(NativeClustering.INDEX_PROPERTY) else null
          val index=stamp?.let { if(it.isJsonPrimitive && it.asJsonPrimitive.isNumber)it.asDouble else -1.0 } ?: -1.0
          val cluster=source in clusteredSources && properties.get("cluster")?.let { it.isJsonPrimitive && it.asJsonPrimitive.isBoolean && it.asBoolean }==true
          val clusterId=properties.get("cluster_id")?.takeIf { it.isJsonPrimitive && it.asJsonPrimitive.isNumber }?.asLong
          val featureId=if(cluster && clusterId!=null) "cluster:$clusterId" else feature.id() ?: ""
          emit("topFeaturePress", Arguments.createMap().apply { putString("sourceId", source); putString("featureId", featureId); putString("layerId", id); putString("propertiesJSON", properties.toString()); putDouble("indexRevision",if(cluster)index else 0.0); putDouble("styleRevision", readyStyleRevision); putDouble("latitude",coordinate.latitude); putDouble("longitude",coordinate.longitude); putDouble("x",point.x.toDouble()/resources.displayMetrics.density); putDouble("y",point.y.toDouble()/resources.displayMetrics.density) })
          return@addOnMapClickListener true
        }
        emitMapPress("tap", coordinate)
        false
      }
      nativeMap.addOnMapLongClickListener { coordinate ->
        emitMapPress("long-press", coordinate)
        false
      }
      markers.forEach { textures[it] = EMMarkerTexture(nativeMap, it) }
      configure()
    }
    addOnDidFinishRenderingFrameListener { fully, _, _ ->
      if(fully) post { publishMarkerClusters() }
    }
    addOnDidFailLoadingMapListener { message -> error("style-load", message) }
  }
  private fun publishMarkerClusters() {
    if(disposed || !isAttachedToWindow || readyStyleRevision!=styleRevision) return
    val nativeMap=map ?: return
    try {
      val markerExtent=markers.maxOfOrNull { marker ->
        val (w,h)=marker.getContentSize()
        maxOf(w*maxOf(marker.anchorX,1f-marker.anchorX)+kotlin.math.abs(marker.offsetX),h*maxOf(marker.anchorY,1f-marker.anchorY)+kotlin.math.abs(marker.offsetY))
      } ?: 0f
      val layout=MarkerClusterLayout.read(nativeMap,markerLayoutSources,clusterIndexRevision,width,height,markerExtent,resources.displayMetrics.density) ?: return
      if(layout==lastMarkerLayout) return
      val json=layout.toJSON()
      lastMarkerLayout=layout
      emit("topMarkerClusters",Arguments.createMap().apply { putString("layoutJSON",json);putDouble("styleRevision",readyStyleRevision) })
    } catch(exception:Exception) { error("marker-cluster",exception.message ?: "Marker cluster layout failed") }
  }
  private fun emitMapPress(action: String, coordinate: LatLng) {
    if(disposed || !mapPressEventsEnabled || readyStyleRevision != styleRevision) return
    val nativeMap=map ?: return
    val point=nativeMap.projection.toScreenLocation(coordinate)
    val density=resources.displayMetrics.density
    emit("topMapPress", Arguments.createMap().apply {
      putString("action",action); putDouble("latitude",coordinate.latitude); putDouble("longitude",coordinate.longitude)
      putDouble("x",point.x.toDouble()/density); putDouble("y",point.y.toDouble()/density); putDouble("styleRevision",readyStyleRevision)
    })
  }
  private fun observeGesture(kind: Int, phase: Int, detector: MultiFingerGesture<*>) {
    if(disposed) return
    // The SDK suppresses move-start callbacks while a previous movement is active.
    // Observe recognition even when JS gesture subscriptions are disabled.
    if(phase == 0) { cameraOrigins.gestureBegan();regionIsGesture=true }
    // The SDK's camera-move listener can coalesce gesture motion until idle.
    // Recognized input updates also sample the current native viewport.
    if(phase == 1) emitRegionEvent(false)
    val point=detector.focalPoint
    val density=resources.displayMetrics.density
    val sample=gestureEvents.next(kind,phase,android.os.SystemClock.uptimeMillis().toDouble(),point.x.toDouble()/density,point.y.toDouble()/density,gestureEventsEnabled && isAttachedToWindow,gestureEventIntervalMs) ?: return
    emitGesture(sample)
  }
  private fun emitGesture(sample: GestureEventGate.Sample) {
    if(!gestureEventsEnabled || disposed) return
    emit("topGesture",Arguments.createMap().apply {
      putString("kind",gestureKinds[sample.kind]); putString("phase",gesturePhases[sample.phase])
      putDouble("id",sample.id.toDouble()); putDouble("timestampMs",sample.timestampMs)
      putDouble("x",sample.x); putDouble("y",sample.y); putDouble("subscriptionRevision",gestureSubscriptionRevision)
    })
  }
  private fun cancelNativeGestures() {
    gestureEvents.cancelAll(android.os.SystemClock.uptimeMillis().toDouble()).forEach { emitGesture(it) }
  }
  fun configureTextureMode(value: Boolean) { if(value) error("unsupported-configuration", "textureMode is not supported by this native host") }
  private fun applyMapPadding(nativeMap:MapLibreMap) {
    if(disposed || width<=0 || height<=0)return
    val logical=doubleArrayOf(mapPaddingLeft,mapPaddingTop,mapPaddingRight,mapPaddingBottom)
    val valid=logical.all { it.isFinite() && it>=0 && it<=100000 }
    val requested=if(valid)logical.map { kotlin.math.ceil(it*resources.displayMetrics.density).toInt() }.toIntArray() else intArrayOf(0,0,0,0)
    val fits=valid && requested[0].toLong()+requested[2]<width && requested[1].toLong()+requested[3]<height
    val errorKey=if(fits)null else "${logical.joinToString()}/$width/$height"
    if(errorKey!=null && errorKey!=lastPaddingError)error("invalid-map-padding","Map padding leaves no valid viewport; using zero padding")
    lastPaddingError=errorKey
    val effective=if(fits)requested else intArrayOf(0,0,0,0)
    if(appliedMapPadding?.contentEquals(effective)==true)return
    val camera=CameraPosition.Builder(nativeMap.cameraPosition).padding(effective.map { it.toDouble() }.toDoubleArray()).build()
    nativeMap.setPadding(effective[0],effective[1],effective[2],effective[3])
    submitCamera(camera,0.0,true)
    appliedMapPadding=effective
  }
  private fun applyMapSettings(nativeMap:MapLibreMap) {
    if(!minZoomLevel.isFinite() || !maxZoomLevel.isFinite() || minZoomLevel<0 || maxZoomLevel>24 || minZoomLevel>maxZoomLevel) {
      error("invalid-settings","Map zoom limits must be ordered within [0,24]");return
    }
    nativeMap.uiSettings.apply {
      if(isScrollGesturesEnabled!=scrollEnabled)isScrollGesturesEnabled=scrollEnabled
      if(isZoomGesturesEnabled!=zoomEnabled)isZoomGesturesEnabled=zoomEnabled
      if(isQuickZoomGesturesEnabled!=zoomEnabled)isQuickZoomGesturesEnabled=zoomEnabled
      if(isRotateGesturesEnabled!=rotateEnabled)isRotateGesturesEnabled=rotateEnabled
      if(isTiltGesturesEnabled!=pitchEnabled)isTiltGesturesEnabled=pitchEnabled
      if(isCompassEnabled!=showsCompass)isCompassEnabled=showsCompass
    }
    if(nativeMap.minZoomLevel!=minZoomLevel || nativeMap.maxZoomLevel!=maxZoomLevel) {
      // Widen first so replacing disjoint intervals never crosses SDK limits.
      nativeMap.setMinZoomPreference(0.0);nativeMap.setMaxZoomPreference(24.0)
      nativeMap.setMinZoomPreference(minZoomLevel);nativeMap.setMaxZoomPreference(maxZoomLevel)
    }
    applyMapPadding(nativeMap)
  }
  fun configure() {
    val nativeMap = map ?: return
    if (disposed) return
    applyMapSettings(nativeMap)
    updateLocationSource()
    if (!configured) {
      configured = true
      animateCamera(latitude,longitude,zoom,heading,pitch,0.0)
    }
    if (styleURL.isNotEmpty() && (styleURL != loadedURL || styleRevision != loadedStyleRevision)) {
      val requestedURL = styleURL
      val requestedRevision = styleRevision
      val generation = ++styleGeneration
      loadedURL = requestedURL
      loadedStyleRevision = requestedRevision
      cancelSnapshot()
      markers.forEach{it.cancelDrag()}
      shaderLayerOwners.clear()
      userLocation.configure(false)
      nativeMap.setStyle(Style.Builder().fromUri(requestedURL)) {
        if (!disposed && generation == styleGeneration && loadedURL == requestedURL && styleURL == requestedURL && styleRevision == requestedRevision) {
          readyStyleRevision = requestedRevision
          updateLocationSource()
          lastMarkerLayout = null
          appliedScene = null; sceneSources = emptyList(); sceneLayers = emptyList(); orderStyle = null
          if (!applyScene()) acceptedScene?.let { applyScene(it) }
          orderDirty = true; scheduleFrame()
          emit("topMapReady", Arguments.createMap().apply { putBoolean("ready", true); putString("capabilitiesJSON", NativeMapCapabilities.JSON); putDouble("styleRevision", requestedRevision) })
        }
      }
    } else applyScene()
  }
  fun applyScene(json: String = sceneJSON): Boolean {
    if (disposed) return false
    val style = map?.style ?: return false
    if (!style.isFullyLoaded) return false
    if (appliedScene == json) return true
    if (json.length > 4*1024*1024 || json.toByteArray(Charsets.UTF_8).size > 4*1024*1024) {
      error("layer-scene", "Scene exceeds 4 MiB UTF-8 byte limit")
      return false
    }
    try {
      val scene = JSONObject(json)
      val sources = scene.getJSONArray("sources")
      val layers = scene.getJSONArray("layers")
      val parsedSources=(0 until sources.length()).map { NativeClustering.parse(sources.getJSONObject(it),clusterIndexRevision+1) }
      // Parse first so malformed JSON never removes a working scene.
      val revisions = (0 until sources.length()).map { sources.getJSONObject(it).let { source ->
        val rawRevision = if (source.has("revision")) source.get("revision") else null
        require(rawRevision == null || rawRevision is Number) { "Source revision must be a number" }
        SourceRevisionGate.Source(source.getString("id"), (rawRevision as? Number)?.toDouble(), parsedSources[it].identity)
      } }
      sourceRevisions.validate(revisions)
      // Extract before mutating the style; commit only after the scene succeeds.
      val nextMarkerLayoutSources=(0 until sources.length()).map { sources.getJSONObject(it) }
        .filter { it.getString("id").let { id -> id=="em-marker-clusters" || id.startsWith("em-marker-clusters:") } }
        .map { MarkerClusterLayout.Source(it.getString("id"),it.getLong("revision")) }
      val parsedLayers = (0 until layers.length()).map { layers.getJSONObject(it).also { layer -> require(!layer.has("clusterFilter") || layer.getString("clusterFilter") in listOf("clusters","points")) { "Invalid cluster filter" } } }
      val metricSources=(0 until sources.length()).map { sources.getJSONObject(it) }.filter { it.optBoolean("lineMetrics",false) }.map { it.getString("id") }.toSet()
      val gradients=parsedLayers.associate { definition ->
        val expression=NativeLineGradient.parse(definition.optJSONObject("style"))
        require(expression==null || (definition.getString("type")=="line" && definition.getString("source") in metricSources)) { "Gradient requires a line-metrics source" }
        definition.getString("id") to expression
      }
      require(clusterIndexRevision<9007199254740991L) { "Cluster index revisions exhausted" }
      ++clusterIndexRevision
      sceneLayers.asReversed().forEach { style.removeLayer(it) }; sceneSources.forEach { style.removeSource(it) }
      sceneSources = emptyList(); sceneLayers = emptyList(); layerSources.clear(); interactiveLayers.clear()
      // Inline scene data and Marker props belong to the same Fabric commit.
      // Async GeoJSON tiles can otherwise display different coordinate revisions.
      // This work happens on data changes, never on camera frames.
      parsedSources.forEach { source -> style.addSource(GeoJsonSource(source.id,source.data,source.options)); sceneSources = sceneSources + source.id }
      parsedLayers.forEach { definition ->
        val id = definition.getString("id"); if(definition.optBoolean("interactive",false)) interactiveLayers.add(id); val source = definition.getString("source"); val properties = definition.optJSONObject("style") ?: JSONObject()
        val layer: Layer = when (definition.getString("type")) {
          "circle" -> CircleLayer(id,source).apply { if(properties.has("circleColor")) setProperties(circleColor(properties.getString("circleColor"))); if(properties.has("circleRadius")) setProperties(circleRadius(properties.getDouble("circleRadius").toFloat())); if(properties.has("circleOpacity")) setProperties(circleOpacity(properties.getDouble("circleOpacity").toFloat())) }
          "line" -> LineLayer(id,source).apply { gradients[id]?.let { setProperties(lineGradient(it)) }; if(properties.has("lineColor")) setProperties(lineColor(properties.getString("lineColor"))); if(properties.has("lineWidth")) setProperties(lineWidth(properties.getDouble("lineWidth").toFloat())); if(properties.has("lineOpacity")) setProperties(lineOpacity(properties.getDouble("lineOpacity").toFloat())); if(properties.has("lineCap")) setProperties(lineCap(properties.getString("lineCap"))); if(properties.has("lineJoin")) setProperties(lineJoin(properties.getString("lineJoin"))); if(properties.has("lineMiterLimit")) setProperties(lineMiterLimit(properties.getDouble("lineMiterLimit").toFloat())); if(properties.has("lineDasharray")) { val d=properties.getJSONArray("lineDasharray"); setProperties(lineDasharray(Array(d.length()) { d.getDouble(it).toFloat() })) } }
          "fill" -> FillLayer(id,source).apply { if(properties.has("fillColor")) setProperties(fillColor(properties.getString("fillColor"))); if(properties.has("fillOpacity")) setProperties(fillOpacity(properties.getDouble("fillOpacity").toFloat())) }
          else -> throw IllegalArgumentException("Unsupported layer type")
        }
        if(definition.has("clusterFilter")) {
          val predicate=org.maplibre.android.style.expressions.Expression.eq(org.maplibre.android.style.expressions.Expression.get("cluster"),org.maplibre.android.style.expressions.Expression.literal(true))
          val filter=if(definition.getString("clusterFilter")=="clusters") predicate else org.maplibre.android.style.expressions.Expression.not(predicate)
          when(layer) { is CircleLayer -> layer.setFilter(filter); is LineLayer -> layer.setFilter(filter); is FillLayer -> layer.setFilter(filter) }
        }
        layer.setProperties(visibility(if(definition.optBoolean("visible",true)) "visible" else "none"))
        val before = definition.optString("beforeId")
        if(before.isNotEmpty() && style.getLayer(before) != null) style.addLayerBelow(layer,before) else style.addLayer(layer)
        sceneLayers = sceneLayers + id; layerSources[id] = source
      }
      sourceRevisions.commit(revisions)
      clusteredSources=parsedSources.filter { it.options["cluster"]==true }.map { it.id }.toSet()
      markerLayoutSources = nextMarkerLayoutSources
      appliedScene = json; acceptedScene = json; orderDirty = true
      return true
    } catch (exception: Exception) { error("layer-scene", exception.message ?: "Invalid scene"); return false }
  }
  fun addMarker(marker: EnhancedMarkerView, index: Int) {
    markers.add(index,marker); marker.owner = this; marker.setLayerType(View.LAYER_TYPE_NONE,null)
    addView(marker); map?.let { textures[marker] = EMMarkerTexture(it,marker) }; markerChanged(); scheduleFrame()
  }
  fun removeMarker(index: Int) {
    val marker = markers.removeAt(index); marker.cancelDrag();textures.remove(marker)?.close(); marker.owner = null; removeView(marker); orderDirty = true
  }
  fun markerChanged() {
    orderDirty = true
    // Fabric has committed marker props. Submit geography now, not next vsync.
    textures.values.forEach { it.updateCoordinate() }
    updatePositions()
    scheduleFrame()
  }
  private fun updatePositions() {
    val nativeMap = map ?: return
    markers.forEach { marker ->
      val position = nativeMap.projection.toScreenLocation(LatLng(marker.latitude,marker.longitude))
      val (width,height) = marker.getContentSize()
      // Keep Yoga's child layout intact while positioning the input host natively.
      marker.x = position.x - width * marker.anchorX + marker.offsetX
      marker.y = position.y - height * marker.anchorY + marker.offsetY
    }
  }
  private fun synchronizeOrder() {
    val style = map?.style ?: return
    if (!orderDirty && style === orderStyle) return
    val ordered = markers.sortedWith(compareBy<EnhancedMarkerView> { it.markerZIndex }.thenBy { it.mountOrder })
    if (ordered.any { textures[it]?.orderingStyle() !== style }) return
    ordered.forEachIndexed { rank, marker -> marker.translationZ = (rank + 1).toFloat(); bringChildToFront(marker) }
    var previous: String? = null
    ordered.forEach { marker -> previous = textures[marker]?.placeAbove(previous) }
    orderDirty = false; orderStyle = style
  }
  private fun scheduleFrame() { if(!framePending && !disposed && isAttachedToWindow && markers.isNotEmpty()) { framePending = true; clock.postFrameCallback(frame) } }
  override fun onAttachedToWindow() { super.onAttachedToWindow(); if(!resumed) onHostResume(); userLocation.resume(); scheduleFrame() }
  override fun onDetachedFromWindow() { cancelSnapshot();userLocation.pause();cancelNativeGestures(); markerGestures.end(); clock.removeFrameCallback(frame); framePending = false; super.onDetachedFromWindow() }
  override fun requestLayout() {
    super.requestLayout()
    // Fabric owns this view's frame and can omit the ordinary Android measure pass
    // requested by SDK children created asynchronously after the first layout.
    if(!sdkLayoutPending) {
      sdkLayoutPending=true
      post {
        sdkLayoutPending=false
        if(!disposed && isAttachedToWindow && width>0 && height>0) onLayout(false,left,top,right,bottom)
      }
    }
  }
  override fun onLayout(changed: Boolean,left: Int,top: Int,right: Int,bottom: Int) {
    val widthSpec=View.MeasureSpec.makeMeasureSpec(right-left,View.MeasureSpec.EXACTLY)
    val heightSpec=View.MeasureSpec.makeMeasureSpec(bottom-top,View.MeasureSpec.EXACTLY)
    for(index in 0 until childCount) {
      val child=getChildAt(index)
      if(child !is EnhancedMarkerView) measureChildWithMargins(child,widthSpec,0,heightSpec,0)
    }
    super.onLayout(changed,left,top,right,bottom)
    map?.let { applyMapPadding(it) }
    // FrameLayout owns SDK ornaments, but Yoga owns every marker subtree's size.
    markers.forEach { marker -> val (w,h)=marker.getContentSize(); marker.layout(0,0,w.toInt(),h.toInt()) }
    updatePositions()
  }
  fun markerDragCoordinate(latitude:Double,longitude:Double,deltaX:Float,deltaY:Float):LatLng? {
    val nativeMap=map ?: return null
    if(disposed || !isAttachedToWindow || readyStyleRevision!=styleRevision)return null
    val point=nativeMap.projection.toScreenLocation(LatLng(latitude,longitude))
    val coordinate=nativeMap.projection.fromScreenLocation(android.graphics.PointF(point.x+deltaX,point.y+deltaY))
    return if(coordinate.latitude.isFinite() && coordinate.longitude.isFinite())coordinate else null
  }
  fun setMarkerGestureOwner(marker: EnhancedMarkerView, active: Boolean) {
    if (!disposed && active && marker in markers && markerGestures.claim()) {
      cancelNativeGestures()
      val now=android.os.SystemClock.uptimeMillis()
      val cancel=MotionEvent.obtain(now,now,MotionEvent.ACTION_CANCEL,0f,0f,0)
      try { super.onTouchEvent(cancel) } finally { cancel.recycle() }
    }
    // A released/removed responder must not start a new map gesture midstream.
  }
  override fun onTouchEvent(event: MotionEvent): Boolean =
    if (disposed) false else if (markerGestures.isReserved()) true else super.onTouchEvent(event)
  override fun dispatchTouchEvent(event: MotionEvent): Boolean {
    if (disposed) return false
    if (event.actionMasked == MotionEvent.ACTION_CANCEL) cancelNativeGestures()
    if (event.actionMasked == MotionEvent.ACTION_DOWN) {
      cancelNativeGestures()
      updatePositions()
      synchronizeOrder()
      val path=TouchTargetHelper.findTargetPathAndCoordinatesForTouch(event.x,event.y,this,touchCoordinates)
      markerGestures.begin(path.any { it.getView() is EnhancedMarkerView })
    }
    try { return super.dispatchTouchEvent(event) }
    finally {
      if (event.actionMasked==MotionEvent.ACTION_UP || event.actionMasked==MotionEvent.ACTION_CANCEL) markerGestures.end()
    }
  }
  fun queryMap(requestId:Double, requestJSON:String) {
    if(disposed) return
    var revision=styleRevision
    var result=""
    var failure=""
    try {
      require(requestId.isFinite() && requestId>=1 && requestId%1.0==0.0 && requestJSON.toByteArray(Charsets.UTF_8).size<=65536)
      val request=JSONObject(requestJSON)
      revision=request.getDouble("styleRevision")
      val nativeMap=map
      require(nativeMap!=null && readyStyleRevision==revision && styleRevision==revision) { "Map is not ready" }
      if(request.getString("kind")=="snapshot") {
        require(shaderLayerOwners.isEmpty()) {"Snapshots with ShaderLayer are not supported"}
        require(snapshotOperation==null) {"A snapshot is already in progress"}
        val generation=++snapshotGeneration
        snapshotOperation=MapSnapshot.start(nativeMap,this,request) { output,error ->
          if(generation==snapshotGeneration)snapshotOperation=null
          if(disposed || !isAttachedToWindow || generation!=snapshotGeneration || readyStyleRevision!=revision || styleRevision!=revision) {if(output!=null)MapSnapshot.discardResult(this,output)}
          else emit("topMapQueryResult",Arguments.createMap().apply {putDouble("requestId",requestId);putDouble("styleRevision",revision);putString("resultJSON",output?.toString() ?: "");putString("error",error ?: "")})
        }
        return
      }
      val response=when(request.getString("kind")) {
        "shaderLayer" -> {
          val style=nativeMap.style ?: throw IllegalStateException("Style not ready")
          val id=request.getString("id");require(Regex("^[a-zA-Z0-9_.:-]{1,128}$").matches(id))
          val pool=request.getString("poolId")
          when(request.getString("action")) {
            "attach" -> {
              snapshotOperation?.cancel()
              require(shaderLayerOwners[id]==null || shaderLayerOwners[id]==pool) { "Duplicate shader layer id" }
              require(style.getLayer(id)==null || shaderLayerOwners[id]==pool) { "Duplicate style layer id" }
              val before=if(request.has("beforeId")) {
                val beforeID=request.getString("beforeId");require(beforeID!=id)
                style.getLayer(beforeID) ?: throw IllegalArgumentException("beforeId layer is missing")
              } else if(request.optString("placement")=="above-labels")null else style.layers.firstOrNull { it is SymbolLayer }
              val weakOwner=java.lang.ref.WeakReference(this)
              val repaintRevision=revision
              val layer=CustomLayer(id,SharedOutputNative.host(pool,Runnable {
                com.facebook.react.bridge.UiThreadUtil.runOnUiThread {
                  val owner=weakOwner.get()
                  // A queued GPU callback can outlive its layer, style or native map.
                  if(owner!=null && !owner.disposed && owner.styleRevision==repaintRevision && owner.readyStyleRevision==repaintRevision && owner.shaderLayerOwners[id]==pool) {
                    owner.map?.triggerRepaint()
                  }
                }
              }))
              if(shaderLayerOwners[id]==pool)style.removeLayer(id)
              if(before==null)style.addLayer(layer) else style.addLayerBelow(layer,before.id)
              shaderLayerOwners[id]=pool
            }
            "remove" -> if(shaderLayerOwners[id]==pool) { style.removeLayer(id);shaderLayerOwners.remove(id) }
            "redraw" -> { require(shaderLayerOwners[id]==pool) { "Shader layer owner mismatch" };nativeMap.triggerRepaint() }
            else -> throw IllegalArgumentException("Invalid shader action")
          }
          JSONObject().put("accepted",true)
        }
        "clusterChildren", "clusterLeaves", "clusterExpansion" -> NativeClusterQueries.execute(nativeMap,request,clusterIndexRevision,clusteredSources)
        "fit" -> {
          val duration=request.getDouble("durationMs"); require(duration.isFinite() && duration in 0.0..60000.0)
          val fit=NativeCameraFit.camera(nativeMap,request,acceptedScene,markers,resources.displayMetrics.density,appliedMapPadding ?: intArrayOf(0,0,0,0))
          val initial=nativeMap.cameraPosition
          fitPreflight=true;regionIsGesture=false
          try {
            // SDK fitting projects from the current transform. Recenter the
            // preflight first so distant geometry is not behind a pitched camera.
            val center=fit.bounds.center
            center.longitude=(center.longitude+180)%360-180
            submitCamera(CameraPosition.Builder(initial).target(center).build(),0.0)
            val camera=requireNotNull(nativeMap.getCameraForLatLngBounds(fit.bounds,fit.padding,initial.bearing,initial.tilt)) { "Could not fit map geometry" }
            require(camera.target!=null && camera.target!!.latitude.isFinite() && camera.target!!.longitude.isFinite() && camera.zoom.isFinite() && camera.bearing.isFinite() && camera.tilt.isFinite()) { "Invalid fitted camera" }
            submitCamera(camera,0.0)
            val pivot=nativeMap.projection.toScreenLocation(requireNotNull(camera.target))
            require(pivot.x.isFinite() && pivot.y.isFinite()) { "Could not project fitted camera" }
            var contained=false
            for(attempt in 0..32) {
              var ratio=1.0
              contained=true
              for(coordinate in fit.corners) {
                val point=nativeMap.projection.toScreenLocation(coordinate)
                if(!point.x.isFinite() || !point.y.isFinite()) { contained=false;ratio=16.0;break }
                if(point.x<fit.edges[0]-.01 || point.x>nativeMap.width-fit.edges[2]+.01 || point.y<fit.edges[1]-.01 || point.y>nativeMap.height-fit.edges[3]+.01) contained=false
                ratio=maxOf(ratio,(pivot.x-point.x)/maxOf(1.0,pivot.x-fit.edges[0]),(point.x-pivot.x)/maxOf(1.0,nativeMap.width-fit.edges[2]-pivot.x),(pivot.y-point.y)/maxOf(1.0,pivot.y-fit.edges[1]),(point.y-pivot.y)/maxOf(1.0,nativeMap.height-fit.edges[3]-pivot.y))
              }
              if(contained || attempt==32)break
              val zoom=nativeMap.zoom
              val next=maxOf(nativeMap.minZoomLevel,zoom-kotlin.math.log2(ratio).coerceIn(.25,4.0))
              if(next>=zoom-1e-9)break
              // Keep Transform's camera cache current for rollback and animation
              // restoration; the raw SDK setZoom path bypasses that cache.
              nativeMap.moveCamera(CameraUpdateFactory.newCameraPosition(CameraPosition.Builder(camera).zoom(next).build()))
            }
            require(contained) { "Could not fit coordinates within padded viewport" }
            // Some SDK seeds are excessively wide in short pitched viewports.
            // Tighten only while every geographic bound corner remains padded.
            var target=nativeMap.cameraPosition
            var low=target.zoom
            var high=nativeMap.maxZoomLevel
            repeat(16) {
              if(high-low>.001) {
                val zoom=(low+high)/2
                nativeMap.moveCamera(CameraUpdateFactory.newCameraPosition(CameraPosition.Builder(target).zoom(zoom).build()))
                val fits=fit.corners.all { coordinate ->
                  val point=nativeMap.projection.toScreenLocation(coordinate)
                  point.x.isFinite() && point.y.isFinite() && point.x>=fit.edges[0]+1 && point.x<=nativeMap.width-fit.edges[2]-1 && point.y>=fit.edges[1]+1 && point.y<=nativeMap.height-fit.edges[3]-1
                }
                if(fits) { low=zoom;target=nativeMap.cameraPosition } else high=zoom
              }
            }
            nativeMap.moveCamera(CameraUpdateFactory.newCameraPosition(target))
            if(duration>0) nativeMap.moveCamera(CameraUpdateFactory.newCameraPosition(initial))
            fitPreflight=false
            submitCamera(target,duration)
            if(duration<=0)emitRegionEvent(true)
          } catch(error:Exception) { fitPreflight=true;nativeMap.moveCamera(CameraUpdateFactory.newCameraPosition(initial));throw error }
          finally {fitPreflight=false}
          JSONObject().put("accepted",true)
        }
        "point" -> {
          val latitude=request.getDouble("latitude"); val longitude=request.getDouble("longitude")
          require(latitude.isFinite() && longitude.isFinite() && kotlin.math.abs(latitude)<=90 && kotlin.math.abs(longitude)<=180)
          val point=nativeMap.projection.toScreenLocation(LatLng(latitude,longitude))
          JSONObject().put("x",point.x.toDouble()/resources.displayMetrics.density).put("y",point.y.toDouble()/resources.displayMetrics.density)
        }
        "coordinate" -> {
          val x=(request.getDouble("x")*resources.displayMetrics.density).toFloat(); val y=(request.getDouble("y")*resources.displayMetrics.density).toFloat()
          require(x.isFinite() && y.isFinite())
          val coordinate=nativeMap.projection.fromScreenLocation(android.graphics.PointF(x,y))
          JSONObject().put("latitude",coordinate.latitude).put("longitude",coordinate.longitude)
        }
        "camera" -> {
          val camera=nativeMap.cameraPosition
          val center= requireNotNull(camera.target)
          JSONObject().put("center",JSONObject().put("latitude",center.latitude).put("longitude",center.longitude)).put("zoom",camera.zoom).put("heading",camera.bearing).put("pitch",camera.tilt)
        }
        "bounds" -> {
          val bounds=nativeMap.projection.visibleRegion.latLngBounds
          JSONObject().put("north",bounds.latitudeNorth).put("south",bounds.latitudeSouth).put("east",bounds.longitudeEast).put("west",bounds.longitudeWest)
        }
        else -> throw IllegalArgumentException("Unknown map query")
      }
      result=response.toString()
    } catch(error:Exception) { failure=error.message ?: "Invalid map query" }
    emit("topMapQueryResult",Arguments.createMap().apply { putDouble("requestId",requestId); putDouble("styleRevision",revision); putString("resultJSON",result); putString("error",failure) })
  }
  private fun emitRegionEvent(complete:Boolean) {
    val nativeMap=map ?: return
    if(disposed || fitPreflight || !regionEventsEnabled || readyStyleRevision!=styleRevision)return
    val bounds=nativeMap.projection.visibleRegion.latLngBounds
    val west=bounds.longitudeWest; val east=bounds.longitudeEast
    val delta=if(east>=west) east-west else east+360-west
    val key="$readyStyleRevision:$regionIsGesture:${bounds.latitudeNorth}:${bounds.latitudeSouth}:$west:$east"
    if(complete) {
      if(key==lastCompletedRegionKey)return
      lastCompletedRegionKey=key;lastMovingRegionKey=null
    } else {
      if(key==lastCompletedRegionKey || key==lastMovingRegionKey)return
      lastCompletedRegionKey=null;lastMovingRegionKey=key
    }
    emit("topRegionEvent",Arguments.createMap().apply {
      putDouble("latitude",(bounds.latitudeNorth+bounds.latitudeSouth)/2)
      putDouble("longitude",((west+delta/2+180)%360+360)%360-180)
      putDouble("latitudeDelta",bounds.latitudeNorth-bounds.latitudeSouth)
      putDouble("longitudeDelta",delta.coerceAtMost(360.0))
      putBoolean("isGesture",regionIsGesture);putBoolean("complete",complete)
      putDouble("styleRevision",readyStyleRevision)
    })
  }
  var regionEventsEnabled = false
  fun animateCamera(latitude:Double,longitude:Double,zoom:Double,heading:Double,pitch:Double,durationMs:Double) {
    val nativeMap=map ?: return
    if(disposed) return
    submitCamera(CameraPosition.Builder(nativeMap.cameraPosition).padding((appliedMapPadding ?: intArrayOf(0,0,0,0)).map { it.toDouble() }.toDoubleArray()).target(LatLng(latitude,longitude)).zoom(zoom).bearing(heading).tilt(pitch).build(),durationMs)
  }
  private fun submitCamera(camera:CameraPosition,durationMs:Double,force:Boolean=false) {
    val nativeMap=map ?: return
    val update=CameraUpdateFactory.newCameraPosition(camera)
    // Match Transform's exact no-op check before taking ownership of an existing movement.
    if(!force && update.getCameraPosition(nativeMap) == nativeMap.cameraPosition) return
    val command=cameraOrigins.beginApplicationCommand()
    val callback=object : MapLibreMap.CancelableCallback {
      override fun onFinish() { cameraOrigins.finishApplicationCommand(command) }
      override fun onCancel() { cameraOrigins.finishApplicationCommand(command) }
    }
    try {
      if(durationMs<=0) nativeMap.moveCamera(update,callback) else nativeMap.animateCamera(update,durationMs.toInt().coerceAtLeast(1),callback)
    } catch(error:Exception) { cameraOrigins.finishApplicationCommand(command); throw error }
  }
  override fun onHostResume() { if(isAttachedToWindow)userLocation.resume(); if(!disposed && !resumed) { onStart(); onResume(); resumed=true } }
  override fun onHostPause() { snapshotOperation?.cancel();userLocation.pause(); markers.forEach{it.cancelDrag()}; cancelNativeGestures(); markerGestures.end(); if(resumed) { onPause(); onStop(); resumed=false } }
  override fun onHostDestroy() { dispose() }
  fun dispose() { if(disposed)return; cancelSnapshot();userLocation.close();markers.forEach{it.cancelDrag()};disposed=true; ++styleGeneration; sourceRevisions.close(); cameraOrigins.reset(); gestureEvents.reset(); acceptedScene=null; markerLayoutSources=emptyList(); appliedScene=null; clock.removeFrameCallback(frame); textures.values.forEach { it.close() }; textures.clear(); markers.forEach { it.owner=null }; markerGestures.end(); onHostPause(); reactContext.removeLifecycleEventListener(this); onDestroy() }
  private fun error(code:String,message:String) { emit("topMapError",Arguments.createMap().apply { putString("code",code); putString("message",message) }) }
  private fun emit(name:String,data:WritableMap) { if(disposed || id==View.NO_ID)return; UIManagerHelper.getEventDispatcherForReactTag(reactContext,id)?.dispatchEvent(MapEvent(UIManagerHelper.getSurfaceId(this),id,name,data)) }
}
private class MapEvent(surfaceId:Int,tag:Int,private val name:String,private val data:WritableMap):Event<MapEvent>(surfaceId,tag) { override fun getEventName()=name; override fun canCoalesce()=name!="topGesture" && name!="topMapPress" && name!="topFeaturePress" && name!="topMapQueryResult"; override fun getEventData()=data }
