package com.enhancedmaps

import org.json.JSONObject
import org.maplibre.android.geometry.LatLng
import org.maplibre.android.geometry.LatLngQuad
import org.maplibre.android.style.sources.ImageSource
import android.graphics.Bitmap

internal object NativeImageOverlay {
  fun source(definition:JSONObject,image:Bitmap):ImageSource {
    val coordinates=definition.getJSONArray("coordinates")
    fun corner(index:Int)=coordinates.getJSONArray(index).let { LatLng(it.getDouble(1),it.getDouble(0)) }
    val quad=LatLngQuad(corner(0),corner(1),corner(2),corner(3))
    return ImageSource(definition.getString("id"),quad,image)
  }
}
