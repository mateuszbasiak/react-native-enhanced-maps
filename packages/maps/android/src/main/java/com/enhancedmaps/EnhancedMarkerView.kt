package com.enhancedmaps

import android.content.Context
import android.graphics.Canvas
import android.graphics.Rect
import android.view.View
import android.view.ViewParent
import com.facebook.react.views.view.ReactViewGroup

/** Mounted React subtree supplies input and dirty notifications; MapLibre supplies pixels. */
class EnhancedMarkerView(context: Context) : ReactViewGroup(context) {
  var markerID = ""
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
  override fun onDetachedFromWindow() { owner?.setMarkerGestureOwner(this, false); super.onDetachedFromWindow() }
  companion object { private var nextOrder = 0L }
}
