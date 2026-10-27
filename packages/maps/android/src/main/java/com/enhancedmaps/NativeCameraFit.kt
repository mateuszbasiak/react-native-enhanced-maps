package com.enhancedmaps

import org.json.JSONArray
import org.json.JSONObject
import org.maplibre.android.geometry.LatLng
import org.maplibre.android.geometry.LatLngBounds
import org.maplibre.android.maps.MapLibreMap

internal object NativeCameraFit {
  data class Target(val bounds:LatLngBounds,val corners:List<LatLng>,val edges:List<Double>,val padding:IntArray)
  fun camera(map:MapLibreMap, request:JSONObject, acceptedScene:String?, markers:List<EnhancedMarkerView>, density:Float,persistent:IntArray):Target {
    val points=mutableListOf<LatLng>()
    fun add(latitude:Double,longitude:Double) {
      require(latitude.isFinite() && longitude.isFinite() && kotlin.math.abs(latitude)<=90 && kotlin.math.abs(longitude)<=180) { "Invalid fit coordinate" }
      require(points.size<100000) { "Too many fit positions" }
      points.add(LatLng(latitude,longitude))
    }
    fun positions(value:JSONArray,depth:Int) {
      require(depth<=32)
      if(value.length()>=2 && value.opt(0) is Number && value.opt(1) is Number) add(value.getDouble(1),value.getDouble(0))
      else for(i in 0 until value.length()) positions(value.getJSONArray(i),depth+1)
    }
    fun geometry(value:JSONObject,depth:Int) {
      require(depth<=32)
      when(value.optString("type")) {
        "FeatureCollection" -> value.getJSONArray("features").let { for(i in 0 until it.length()) geometry(it.getJSONObject(i),depth+1) }
        "Feature" -> value.optJSONObject("geometry")?.let { geometry(it,depth+1) }
        "GeometryCollection" -> value.getJSONArray("geometries").let { for(i in 0 until it.length()) geometry(it.getJSONObject(i),depth+1) }
        else -> value.optJSONArray("coordinates")?.let { positions(it,depth+1) }
      }
    }
    val explicit=request.getString("coordinatesJSON")
    if(explicit.isNotEmpty()) {
      val input=JSONArray(explicit); require(input.length() in 1..1000)
      for(i in 0 until input.length()) input.getJSONArray(i).let { require(it.length()==2); add(it.getDouble(0),it.getDouble(1)) }
    } else {
      acceptedScene?.let { JSONObject(it).getJSONArray("sources").let { sources -> for(i in 0 until sources.length()) { val source=sources.getJSONObject(i);if(request.optInt("markersOnly")==0 || source.has("cluster")) geometry(source.getJSONObject("data"),0) } } }
      markers.filter{it.markerID!="em-cluster:user-location"}.forEach { add(it.latitude,it.longitude) }
    }
    require(points.isNotEmpty()) { "No map elements to fit" }
    // Leave two physical pixels for the SDK's projection/fit raster rounding.
    val edges=arrayOf("left","top","right","bottom").mapIndexed { index,name ->
      request.getDouble(name).also { v -> require(v.isFinite() && v>=0 && v<=100000) }*density+persistent[index]+2.0
    }
    require(edges[0]+edges[2]<map.width && edges[1]+edges[3]<map.height) { "Fit padding leaves no viewport" }
    val longitudes=points.map { (it.longitude+360)%360 }.sorted()
    var gap=-1.0; var start=0
    for(i in longitudes.indices) { val next=if(i+1<longitudes.size)longitudes[i+1] else longitudes[0]+360; if(next-longitudes[i]>gap) {gap=next-longitudes[i];start=(i+1)%longitudes.size} }
    var west=longitudes[start]; if(west>180)west-=360
    var east=west+360-gap
    if(request.has("regionLongitude")) {
      val center=request.getDouble("regionLongitude");val span=request.getDouble("regionLongitudeDelta")
      require(center.isFinite() && kotlin.math.abs(center)<=180 && span.isFinite() && span>0 && span<=360)
      west=center-span/2;east=center+span/2
    }
    val bounds=LatLngBounds.from(points.maxOf { it.latitude },east,points.minOf { it.latitude },west)
    return Target(bounds,listOf(bounds.southWest,bounds.southEast,bounds.northEast,bounds.northWest).map { LatLng(it.latitude,(it.longitude+180)%360-180) },edges.map { it-2 },edges.map { kotlin.math.ceil(it).toInt() }.toIntArray())
  }
}
