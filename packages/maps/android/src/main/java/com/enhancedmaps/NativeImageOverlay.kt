package com.enhancedmaps

import android.content.Context
import org.json.JSONObject
import org.maplibre.android.geometry.LatLng
import org.maplibre.android.geometry.LatLngQuad
import org.maplibre.android.style.sources.ImageSource
import java.net.URI

internal object NativeImageOverlay {
  fun source(context:Context,definition:JSONObject):ImageSource {
    val coordinates=definition.getJSONArray("coordinates")
    fun corner(index:Int)=coordinates.getJSONArray(index).let { LatLng(it.getDouble(1),it.getDouble(0)) }
    val quad=LatLngQuad(corner(0),corner(1),corner(2),corner(3))
    val id=definition.getString("id");val uri=definition.getString("uri")
    if(!uri.contains(":")) {
      val resource=context.resources.getIdentifier(uri,"drawable",context.packageName)
      require(resource!=0) { "Overlay image resource was not found" }
      return ImageSource(id,quad,resource)
    }
    return ImageSource(id,quad,URI(uri))
  }
}
