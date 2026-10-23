package com.enhancedmaps

import android.graphics.RectF
import org.json.JSONArray
import org.json.JSONObject
import org.maplibre.android.maps.MapLibreMap
import org.maplibre.geojson.Point

/** Private layout transport. Application marker data never enters this index. */
internal object MarkerClusterLayout {
  fun read(map:MapLibreMap, scene:String?, index:Long, width:Int, height:Int):String? {
    if(scene==null || width<=0 || height<=0) return null
    val sources=JSONObject(scene).getJSONArray("sources")
    val source=(0 until sources.length()).map { sources.getJSONObject(it) }.find { it.getString("id")=="em-marker-clusters" } ?: return null
    if(map.style?.getLayer("em-marker-clusters-layout")==null) return null
    val features=map.queryRenderedFeatures(RectF(0f,0f,width.toFloat(),height.toFloat()),"em-marker-clusters-layout")
    val entries=sortedMapOf<String,JSONObject>()
    for(feature in features) {
      val properties=feature.properties() ?: return null
      val stamp=properties.get(NativeClustering.INDEX_PROPERTY) ?: return null
      if(!stamp.isJsonPrimitive || !stamp.asJsonPrimitive.isNumber || stamp.asDouble!=index.toDouble()) return null
      val point=feature.geometry() as? Point ?: return null
      val cluster=properties.get("cluster")?.let { it.isJsonPrimitive && it.asJsonPrimitive.isBoolean && it.asBoolean }==true
      val clusterId=if(cluster)feature.getNumberProperty("cluster_id").toLong() else null
      val id=if(cluster)"em-cluster:$clusterId" else feature.id() ?: return null
      val longitude=((point.longitude()+180)%360+360)%360-180
      val entry=JSONObject().put("id",id).put("latitude",point.latitude()).put("longitude",longitude)
      if(cluster)entry.put("clusterId",clusterId).put("count",feature.getNumberProperty("point_count"))
      entries[id]=entry // Deduplicate tile boundaries and wrapped world copies.
      require(entries.size<=10000) { "Marker cluster layout limit exceeded" }
    }
    val result=JSONObject().put("sourceRevision",source.getLong("revision")).put("indexRevision",index).put("features",JSONArray(entries.values.toList())).toString()
    require(result.toByteArray(Charsets.UTF_8).size<=4*1024*1024) { "Marker cluster layout exceeds 4 MiB" }
    return result
  }
}
