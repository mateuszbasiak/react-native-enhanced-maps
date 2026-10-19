package com.enhancedmaps

import android.graphics.Bitmap
import android.util.Base64
import com.google.android.gms.maps.model.LatLng
import com.google.android.gms.maps.model.LatLngBounds
import org.json.JSONObject

/** Decode only on replacement, never on a camera callback. */
internal data class RasterImage(val bitmap: Bitmap, val bounds: LatLngBounds) {
  companion object {
    fun decode(source: String): RasterImage {
      require(source.length <= 352000)
      val json = JSONObject(source)
      val w = json.getDouble("width"); val h = json.getDouble("height")
      require(w in 1.0..256.0 && h in 1.0..256.0 && w % 1 == 0.0 && h % 1 == 0.0)
      val b = json.getJSONObject("bounds")
      val n = b.getDouble("north"); val s = b.getDouble("south"); val e = b.getDouble("east"); val west = b.getDouble("west")
      require(listOf(n, s, e, west).all { it.isFinite() } && n <= 85 && s >= -85 && n > s && west >= -180 && e <= 180 && e > west && e - west <= 180)
      val bytes = Base64.decode(json.getString("rgbaBase64"), Base64.DEFAULT)
      val width = w.toInt(); val height = h.toInt()
      require(bytes.size == width * height * 4)
      val colors = IntArray(width * height) { i ->
        val offset = i * 4
        ((bytes[offset + 3].toInt() and 255) shl 24) or ((bytes[offset].toInt() and 255) shl 16) or ((bytes[offset + 1].toInt() and 255) shl 8) or (bytes[offset + 2].toInt() and 255)
      }
      return RasterImage(Bitmap.createBitmap(colors, width, height, Bitmap.Config.ARGB_8888), LatLngBounds(LatLng(s, west), LatLng(n, e)))
    }
  }
}
