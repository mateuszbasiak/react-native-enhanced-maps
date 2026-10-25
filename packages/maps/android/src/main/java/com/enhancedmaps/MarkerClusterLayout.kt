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
    var sourceRevision:Long?=null
    val entries=sortedMapOf<String,JSONObject>()
    for(i in 0 until sources.length()) {
      val source=sources.getJSONObject(i)
      val sourceId=source.getString("id")
      if(sourceId!="em-marker-clusters" && !sourceId.startsWith("em-marker-clusters:")) continue
      val suffix=sourceId.removePrefix("em-marker-clusters")
      val layerId="em-marker-clusters-layout$suffix"
      if(map.style?.getLayer(layerId)==null) return null
      val revision=source.getLong("revision")
      if(sourceRevision!=null && sourceRevision!=revision) return null
      sourceRevision=revision
      val features=map.queryRenderedFeatures(RectF(0f,0f,width.toFloat(),height.toFloat()),layerId)
      for(feature in features) {
        val properties=feature.properties() ?: return null
        val stamp=properties.get(NativeClustering.INDEX_PROPERTY) ?: return null
        if(!stamp.isJsonPrimitive || !stamp.asJsonPrimitive.isNumber || stamp.asDouble!=index.toDouble()) return null
        val point=feature.geometry() as? Point ?: return null
        val cluster=properties.get("cluster")?.let { it.isJsonPrimitive && it.asJsonPrimitive.isBoolean && it.asBoolean }==true
        val clusterId=if(cluster)feature.getNumberProperty("cluster_id").toLong() else null
        val id=if(cluster)"em-cluster:${if(suffix.isEmpty()) "" else suffix.drop(1)+":"}$clusterId" else feature.id() ?: return null
        val longitude=((point.longitude()+180)%360+360)%360-180
        val entry=JSONObject().put("sourceId",sourceId).put("id",id).put("latitude",point.latitude()).put("longitude",longitude)
        if(cluster)entry.put("clusterId",clusterId).put("count",feature.getNumberProperty("point_count"))
        entries[id]=entry // Deduplicate tile boundaries and wrapped world copies.
        require(entries.size<=10000) { "Marker cluster layout limit exceeded" }
      }
    }
    if(sourceRevision==null) return null
    val result=JSONObject().put("sourceRevision",sourceRevision).put("indexRevision",index).put("features",JSONArray(entries.values.toList())).toString()
    require(result.toByteArray(Charsets.UTF_8).size<=4*1024*1024) { "Marker cluster layout exceeds 4 MiB" }
    return result
  }
}
