package com.enhancedmaps

import org.maplibre.geojson.Geometry
import org.maplibre.geojson.MultiPolygon
import org.maplibre.geojson.Point
import org.maplibre.geojson.Polygon

/** Correct the pinned SDK fill query's hole containment without changing line hits. */
internal object NativeFillHit {
  private fun contains(rings:List<List<Point>>,longitude:Double,latitude:Double):Boolean {
    val result=PolygonHitTest.contains(longitude,latitude,rings.map { ring -> ring.map { doubleArrayOf(it.longitude(),it.latitude()) }.toTypedArray() }.toTypedArray())
    return result
  }
  fun accepts(geometry:Geometry?,longitude:Double,latitude:Double):Boolean = when(geometry) {
    is Polygon -> geometry.coordinates().let { rings -> rings.size<=1 || contains(rings,longitude,latitude) }
    is MultiPolygon -> geometry.coordinates().let { polygons -> polygons.none { it.size>1 } || polygons.any { contains(it,longitude,latitude) } }
    else -> true
  }
}
