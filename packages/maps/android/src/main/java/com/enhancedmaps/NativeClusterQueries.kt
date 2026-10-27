package com.enhancedmaps

import org.json.JSONArray
import org.json.JSONObject
import org.maplibre.android.maps.MapLibreMap
import org.maplibre.android.style.sources.GeoJsonSource
import org.maplibre.geojson.Feature
import org.maplibre.geojson.Point

internal object NativeClusterQueries {
  fun execute(map:MapLibreMap,request:JSONObject,indexRevision:Long,sources:Set<String>):JSONObject {
    fun integer(key:String,min:Long,max:Long):Long {
      val raw=request.get(key)
      require(raw is Number && raw.toDouble().isFinite() && raw.toDouble()%1==0.0 && raw.toDouble() in min.toDouble()..max.toDouble()) { "Invalid cluster $key" }
      return raw.toLong()
    }
    require(integer("indexRevision",1,9007199254740991L)==indexRevision) { "Cluster index is obsolete" }
    val sourceId=request.getString("sourceId")
    require(sourceId in sources) { "Cluster source is unavailable" }
    val source=requireNotNull(map.style?.getSourceAs<GeoJsonSource>(sourceId)) { "Cluster source is unavailable" }
    val clusterId=integer("clusterId",0,4294967295L)
    val count=integer("pointCount",2,9007199254740991L)
    val limit=integer("limit",1,100);val offset=integer("offset",0,9007199254740991L)
    val cluster=Feature.fromGeometry(Point.fromLngLat(0.0,0.0)).apply { addBooleanProperty("cluster",true);addNumberProperty("cluster_id",clusterId);addNumberProperty("point_count",count) }
    val kind=request.getString("kind")
    if(kind=="clusterExpansion") {
      val zoom=source.getClusterExpansionZoom(cluster)
      require(zoom in 0..25) { "Invalid cluster expansion zoom" }
      return JSONObject().put("zoom",zoom)
    }
    val all=if(kind=="clusterChildren") source.getClusterChildren(cluster).features() ?: emptyList() else source.getClusterLeaves(cluster,limit,offset).features() ?: emptyList()
    val page=if(kind=="clusterChildren")all.drop(offset.coerceAtMost(all.size.toLong()).toInt()).take(limit.toInt()) else all
    require(page.size<=limit) { "Cluster page limit exceeded" }
    val features=JSONArray()
    for(feature in page) {
      val point=feature.geometry() as? Point ?: throw IllegalArgumentException("Invalid cluster point geometry")
      val properties=feature.properties()?.deepCopy() ?: com.google.gson.JsonObject()
      val stamp=properties.remove(NativeClustering.INDEX_PROPERTY)
      require(stamp!=null && stamp.isJsonPrimitive && stamp.asJsonPrimitive.isNumber && stamp.asDouble==indexRevision.toDouble()) { "Cluster feature belongs to an obsolete index" }
      val generated=properties?.get("cluster")?.let { it.isJsonPrimitive && it.asJsonPrimitive.isBoolean && it.asBoolean }==true
      val id=if(generated) "cluster:${feature.getNumberProperty("cluster_id").toLong()}" else requireNotNull(feature.id()) { "Cluster point ID is missing" }
      features.put(JSONObject().put("featureId",id).put("latitude",point.latitude()).put("longitude",point.longitude()).put("properties",JSONObject(properties?.toString() ?: "{}")))
    }
    val response=JSONObject().put("sourceId",sourceId).put("indexRevision",indexRevision).put("total",if(kind=="clusterChildren")all.size.toLong() else count).put("offset",offset).put("features",features)
    require(response.toString().toByteArray(Charsets.UTF_8).size<=262144) { "Cluster result exceeds 256KiB" }
    return response
  }
}
