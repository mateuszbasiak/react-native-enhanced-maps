package com.enhancedmaps

import android.content.Context
import android.graphics.Canvas
import android.graphics.Rect
import android.view.View
import android.view.ViewParent
import android.view.MotionEvent
import android.view.GestureDetector
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactContext
import com.facebook.react.bridge.WritableMap
import com.facebook.react.uimanager.UIManagerHelper
import com.facebook.react.uimanager.events.Event
import com.facebook.react.uimanager.events.NativeGestureUtil
import com.facebook.react.views.view.ReactViewGroup

/** Mounted React subtree supplies input and dirty notifications; MapLibre supplies pixels. */
class EnhancedMarkerView(context: Context) : ReactViewGroup(context) {
  var draggable = false
    set(value) { if(field && !value) cancelDrag();field=value }
  var dragRevision = 0.0
    set(value) { if(field!=value) cancelDrag();field=value }
  private var nativeGestureStarted=false
  private var dragging=false
  private var session=0L
  private var sessionRevision=0.0
  private var propLatitude=0.0
  private var propLongitude=0.0
  private var downX=0f
  private var downY=0f
  private var startLatitude=0.0
  private var startLongitude=0.0
  private var touchDown=false
  private val dragDetector=GestureDetector(context,object:GestureDetector.SimpleOnGestureListener(){
    override fun onDown(event:MotionEvent)=true
    override fun onLongPress(event:MotionEvent) {
      if(!draggable || !touchDown || !isAttachedToWindow || owner==null)return
      dragging=true;session++;sessionRevision=dragRevision
      nativeGestureStarted=true;NativeGestureUtil.notifyNativeGestureStarted(this@EnhancedMarkerView,event)
      startLatitude=latitude;startLongitude=longitude
      owner?.setMarkerGestureOwner(this@EnhancedMarkerView,true)
      parent?.requestDisallowInterceptTouchEvent(true)
      emitDrag("start")
      // Cancel React presses even when the finger stays stationary after recognition.
      val cancel=MotionEvent.obtain(event);cancel.action=MotionEvent.ACTION_CANCEL
      try {super@EnhancedMarkerView.dispatchTouchEvent(cancel)} finally {cancel.recycle()}
    }
  })
  fun setPropLatitude(value:Double) {if(value!=propLatitude){propLatitude=value;if(!dragging)latitude=value}}
  fun setPropLongitude(value:Double) {if(value!=propLongitude){propLongitude=value;if(!dragging)longitude=value}}
  fun cancelDrag() {
    if(!dragging)return
    dragging=false;latitude=propLatitude;longitude=propLongitude
    owner?.markerChanged();emitDrag("cancel")
    owner?.setMarkerGestureOwner(this,false)
    endNativeGesture()
  }
  private fun endNativeGesture(event:MotionEvent?=null) {
    if(!nativeGestureStarted)return
    nativeGestureStarted=false
    val value=event ?: MotionEvent.obtain(android.os.SystemClock.uptimeMillis(),android.os.SystemClock.uptimeMillis(),MotionEvent.ACTION_CANCEL,0f,0f,0)
    try {NativeGestureUtil.notifyNativeGestureEnded(this,value)} finally {if(event==null)value.recycle()}
  }
  private fun emitDrag(phase:String) {
    if(id==View.NO_ID)return
    val react=context as? ReactContext ?: return
    val data=Arguments.createMap().apply{putString("phase",phase);putDouble("session",session.toDouble());putDouble("revision",sessionRevision);putDouble("latitude",latitude);putDouble("longitude",longitude)}
    UIManagerHelper.getEventDispatcherForReactTag(react,id)?.dispatchEvent(MarkerDragNativeEvent(UIManagerHelper.getSurfaceId(this),id,data))
  }
  override fun dispatchTouchEvent(event:MotionEvent):Boolean {
    if(event.actionMasked==MotionEvent.ACTION_DOWN) {touchDown=true;downX=event.rawX;downY=event.rawY}
    if(draggable && !dragging)dragDetector.onTouchEvent(event)
    if(dragging) {
      if(event.pointerCount>1 || event.actionMasked==MotionEvent.ACTION_CANCEL) {cancelDrag();touchDown=false;return true}
      if(event.actionMasked==MotionEvent.ACTION_MOVE || event.actionMasked==MotionEvent.ACTION_UP) {
        val coordinate=owner?.markerDragCoordinate(startLatitude,startLongitude,event.rawX-downX,event.rawY-downY)
        if(coordinate==null){cancelDrag();touchDown=false;return true}
        latitude=coordinate.latitude;longitude=coordinate.longitude
        owner?.markerChanged()
        if(event.actionMasked==MotionEvent.ACTION_UP){dragging=false;touchDown=false;emitDrag("end");owner?.setMarkerGestureOwner(this,false);endNativeGesture(event)}
        else emitDrag("update")
      }
      return true
    }
    if(event.actionMasked==MotionEvent.ACTION_UP || event.actionMasked==MotionEvent.ACTION_CANCEL)touchDown=false
    // A Text/image-only marker has no child that consumes DOWN. Keep this view
    // as the native touch target so the later long-press drag receives MOVE/UP.
    return super.dispatchTouchEvent(event) || draggable
  }
  override fun onWindowVisibilityChanged(visibility:Int){if(visibility!=View.VISIBLE)cancelDrag();super.onWindowVisibilityChanged(visibility)}
  var markerID = ""
  var callout = false
  var latitude = 0.0
  var longitude = 0.0
  var markerZIndex = 0.0
  var anchorX = .5f
  var anchorY = 1f
  var offsetX = 0f
  var offsetY = 0f
  val mountOrder = nextOrder++
  internal var owner: EnhancedMapLibreView? = null
  var textureRevision = 0L
    private set
  var synchronizedTexture = false
    set(value) { if (field != value) { field = value; invalidate() } }
  init { clipChildren = false; clipToPadding = false; pointerEvents = com.facebook.react.uimanager.PointerEvents.BOX_NONE }
  override fun onDescendantInvalidated(child: View, target: View) { textureRevision++; super.onDescendantInvalidated(child, target) }
  override fun invalidateChildInParent(location: IntArray?, dirty: Rect?): ViewParent? { textureRevision++; return super.invalidateChildInParent(location, dirty) }
  override fun requestLayout() { textureRevision++; super.requestLayout() }
  override fun onViewAdded(child: View) { textureRevision++; super.onViewAdded(child) }
  override fun onViewRemoved(child: View) { textureRevision++; super.onViewRemoved(child) }
  override fun dispatchDraw(canvas: Canvas) { if (!synchronizedTexture) super.dispatchDraw(canvas) }
  fun drawTexture(canvas: Canvas) { super.dispatchDraw(canvas) }
  fun getContentSize(): Pair<Float,Float> {
    val child = getChildAt(0)
    return Pair((child?.width?.takeIf { it > 0 } ?: width).toFloat(), (child?.height?.takeIf { it > 0 } ?: height).toFloat())
  }
  override fun requestDisallowInterceptTouchEvent(disallowIntercept: Boolean) {
    owner?.setMarkerGestureOwner(this, disallowIntercept)
    super.requestDisallowInterceptTouchEvent(disallowIntercept)
  }
  override fun onDetachedFromWindow() { cancelDrag();touchDown=false;owner?.setMarkerGestureOwner(this, false); super.onDetachedFromWindow() }
  companion object { private var nextOrder = 0L }
}

private class MarkerDragNativeEvent(surfaceId:Int,tag:Int,private val data:WritableMap):Event<MarkerDragNativeEvent>(surfaceId,tag){
  override fun getEventName()="topMarkerDrag"
  override fun canCoalesce()=false
  override fun getEventData()=data
}
