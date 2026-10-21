package com.enhancedmaps

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.RectF
import android.view.View
import android.view.ViewGroup
import org.maplibre.android.maps.MapLibreMap
import org.maplibre.android.maps.Style
import org.maplibre.android.style.layers.SymbolLayer
import org.maplibre.android.style.layers.PropertyFactory.*
import org.maplibre.android.style.sources.GeoJsonOptions
import org.maplibre.android.style.sources.GeoJsonSource
import org.maplibre.geojson.Point

/** Prototype: pixels and geography are composed by the same map render pass. UI thread only. */
internal class EMMarkerTexture(private val map: MapLibreMap, private val marker: EnhancedMarkerView) {
    private val id = "em-marker-texture-${nextId++}"
    private var installedStyle: Style? = null
    private var pixels: Bitmap? = null
    private var previous: Bitmap? = null
    private var longitude = Double.NaN
    private var latitude = Double.NaN
    private var geometry: List<Float>? = null
    private var closed = false
    private var hidden = false
    private var capturedRevision = -1L
    private var captureLeft = 0f
    private var captureTop = 0f
    private var captureCount = 0L
    private var uploadCount = 0L

    fun orderingStyle(): Style? = installedStyle

    private fun makeLayer(): SymbolLayer {
        val (width, height) = marker.getContentSize()
        val density = marker.resources.displayMetrics.density
        return SymbolLayer(id, id).withProperties(
            iconImage(id), iconAnchor("top-left"), iconAllowOverlap(true),
            iconIgnorePlacement(true), iconPitchAlignment("viewport"),
            iconRotationAlignment("viewport"), iconPadding(0f), iconOpacity(1f),
            visibility(if (hidden) "none" else "visible"),
            iconOffset(arrayOf(
                (marker.offsetX - width * marker.anchorX + captureLeft) / density,
                (marker.offsetY - height * marker.anchorY + captureTop) / density
            ))
        )
    }

    // Layer objects are replaced; images, sources and captured pixels stay intact.
    fun placeAbove(previousLayer: String?): String {
        val style = installedStyle ?: return id
        style.removeLayer(id)
        val layer = makeLayer()
        if (previousLayer == null) style.addLayer(layer) else style.addLayerAbove(layer, previousLayer)
        return id
    }

    private fun hide() {
        val style = map.style
        if (!hidden && style != null && style === installedStyle && style.isFullyLoaded) {
            style.getLayerAs<SymbolLayer>(id)?.setProperties(visibility("none"))
            hidden = true
        }
    }

    // Include transformed descendants when their parent permits overflow. Anchor
    // geometry still uses the root layout, not the expanded capture rectangle.
    private fun drawingBounds(view: View, width: Float = view.width.toFloat(), height: Float = view.height.toFloat()): RectF {
        val bounds = RectF(0f, 0f, width, height)
        if (view is ViewGroup && !view.clipChildren) {
            for (i in 0 until view.childCount) {
                val child = view.getChildAt(i)
                if (child.visibility != View.VISIBLE) continue
                val childBounds = drawingBounds(child)
                child.matrix.mapRect(childBounds)
                childBounds.offset((child.left - view.scrollX).toFloat(), (child.top - view.scrollY).toFloat())
                bounds.union(childBounds)
            }
        }
        return bounds
    }

    fun update() {
        if (closed) return
        if (!marker.isAttachedToWindow || !marker.isShown || marker.windowVisibility != View.VISIBLE || marker.childCount == 0) {
            hide()
            return
        }
        val style = map.style ?: return
        if (!style.isFullyLoaded) return
        val (width, height) = marker.getContentSize()
        if (width <= 0 || height <= 0) {
            hide()
            return
        }
        val styleChanged = style !== installedStyle
        val revision = marker.textureRevision
        var changed = false
        // Camera motion only moves the map symbol. It does not dirty the RN subtree.
        if (revision != capturedRevision || pixels == null) {
            val bounds = drawingBounds(marker, width, height)
            captureLeft = kotlin.math.floor(bounds.left)
            captureTop = kotlin.math.floor(bounds.top)
            val w = (kotlin.math.ceil(bounds.right) - captureLeft).toInt()
            val h = (kotlin.math.ceil(bounds.bottom) - captureTop).toInt()
            if (pixels?.width != w || pixels?.height != h) {
                pixels?.recycle()
                previous?.recycle()
                pixels = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888).apply {
                    density = marker.resources.displayMetrics.densityDpi
                }
                previous = null
            }
            val bitmap = pixels!!
            bitmap.eraseColor(android.graphics.Color.TRANSPARENT)
            val canvas = Canvas(bitmap)
            canvas.translate(-captureLeft, -captureTop)
            marker.drawTexture(canvas)
            captureCount++
            capturedRevision = revision // Preserve invalidations raised during capture for the next frame.
            changed = previous?.sameAs(bitmap) != true
            if (changed) {
                if (previous == null) previous = bitmap.copy(Bitmap.Config.ARGB_8888, true)
                else Canvas(previous!!).apply {
                    drawColor(android.graphics.Color.TRANSPARENT, android.graphics.PorterDuff.Mode.CLEAR)
                    drawBitmap(bitmap, 0f, 0f, null)
                }
            }
            if (android.util.Log.isLoggable("EMMarkerTexture", android.util.Log.DEBUG)) {
                android.util.Log.d("EMMarkerTexture", "$id capture=$captureCount changed=$changed")
            }
        }
        if (changed || styleChanged) {
            style.addImage(id, pixels!!)
            uploadCount++
            if (android.util.Log.isLoggable("EMMarkerTexture", android.util.Log.DEBUG)) {
                android.util.Log.d("EMMarkerTexture", "$id upload=$uploadCount")
            }
        }
        val point = Point.fromLngLat(marker.longitude, marker.latitude)
        if (styleChanged) {
            hidden = false
            // A marker source contains exactly one point. Install coordinate changes in
            // the render update instead of allowing an async tile to trail its input host.
            style.addSource(GeoJsonSource(id, point, GeoJsonOptions().withSynchronousUpdate(true)))
            style.addLayer(makeLayer())
            installedStyle = style
            hidden = false
            geometry = null
            longitude = Double.NaN
        }
        updateCoordinate()
        val density = marker.resources.displayMetrics.density
        val nextGeometry = listOf(width, height, marker.anchorX, marker.anchorY, marker.offsetX, marker.offsetY, captureLeft, captureTop)
        if (geometry != nextGeometry) {
            style.getLayerAs<SymbolLayer>(id)?.setProperties(iconOffset(arrayOf(
                (marker.offsetX - width * marker.anchorX + captureLeft) / density,
                (marker.offsetY - height * marker.anchorY + captureTop) / density
            )))
            geometry = nextGeometry
        }
        if (hidden) {
            style.getLayerAs<SymbolLayer>(id)?.setProperties(visibility("visible"))
            hidden = false
        }
        marker.synchronizedTexture = true
    }

    // Called at the native prop commit as well as during initial installation.
    // Moving an existing marker never needs to capture or upload its content.
    fun updateCoordinate() {
        val style = installedStyle ?: return
        if (closed || map.style !== style || !style.isFullyLoaded) return
        if (longitude == marker.longitude && latitude == marker.latitude) return
        style.getSourceAs<GeoJsonSource>(id)?.setGeoJson(Point.fromLngLat(marker.longitude, marker.latitude)) ?: return
        longitude = marker.longitude
        latitude = marker.latitude
    }

    fun close() {
        closed = true
        marker.synchronizedTexture = false
        // A replaced/destroyed style is no longer addressable through the native SDK.
        val current = map.style
        if (current != null && current === installedStyle && current.isFullyLoaded) {
            current.removeLayer(id)
            current.removeSource(id)
            current.removeImage(id)
        }
        installedStyle = null
        pixels?.recycle()
        previous?.recycle()
        pixels = null
        previous = null
    }

    private companion object { var nextId = 0L }
}
