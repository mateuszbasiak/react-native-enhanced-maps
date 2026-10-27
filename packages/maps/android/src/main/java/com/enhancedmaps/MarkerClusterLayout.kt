package com.enhancedmaps

import android.graphics.RectF
import org.json.JSONArray
import org.json.JSONObject
import org.maplibre.android.maps.MapLibreMap
import org.maplibre.geojson.Point

/** Private layout transport. Application marker data never enters this index. */
internal object MarkerClusterLayout {
  data class Source(val id:String, val revision:Long)

  data class Entry(val sourceId:String, val id:String, val latitude:Double, val longitude:Double, val clusterId:Long?, val count:Long?)
  data class Layout(val sourceRevision:Long, val indexRevision:Long, val entries:Map<String,Entry>) {
    fun toJSON():String {
      val features=entries.toSortedMap().values.map { entry ->
        JSONObject().put("sourceId",entry.sourceId).put("id",entry.id).put("latitude",entry.latitude).put("longitude",entry.longitude).apply {
          if(entry.clusterId!=null)put("clusterId",entry.clusterId).put("count",entry.count)
        }
      }
      val result=JSONObject().put("sourceRevision",sourceRevision).put("indexRevision",indexRevision).put("features",JSONArray(features)).toString()
      require(result.toByteArray(Charsets.UTF_8).size<=4*1024*1024) { "Marker cluster layout exceeds 4 MiB" }
      return result
    }
  }

  fun read(map:MapLibreMap, sources:List<Source>, index:Long, width:Int, height:Int, markerExtent:Float, density:Float):Layout? {
    if(sources.isEmpty() || width<=0 || height<=0) return null
    var sourceRevision:Long?=null
    val entries=mutableMapOf<String,Entry>()
    for(source in sources) {
      val sourceId=source.id
      if(sourceId!="em-marker-clusters" && !sourceId.startsWith("em-marker-clusters:")) continue
      val suffix=sourceId.removePrefix("em-marker-clusters")
      val layerId="em-marker-clusters-layout$suffix"
      if(map.style?.getLayer(layerId)==null) return null
      val revision=source.revision
      if(sourceRevision!=null && sourceRevision!=revision) return null
      sourceRevision=revision
      // Query a bounded spatial region, with enough room for measured marker
      // content and a bootstrap margin before new anchors enter the map.
      val padding=maxOf(64f*density,markerExtent)
      val features=map.queryRenderedFeatures(RectF(-padding,-padding,width+padding,height+padding),layerId)
      for(feature in features) {
        val properties=feature.properties() ?: return null
        val stamp=properties.get(NativeClustering.INDEX_PROPERTY) ?: return null
        if(!stamp.isJsonPrimitive || !stamp.asJsonPrimitive.isNumber || stamp.asDouble!=index.toDouble()) return null
        val point=feature.geometry() as? Point ?: return null
        val cluster=properties.get("cluster")?.let { it.isJsonPrimitive && it.asJsonPrimitive.isBoolean && it.asBoolean }==true
        val clusterId=if(cluster)feature.getNumberProperty("cluster_id").toLong() else null
        val id=if(cluster)"em-cluster:${if(suffix.isEmpty()) "" else suffix.drop(1)+":"}$clusterId" else feature.id() ?: return null
        val longitude=((point.longitude()+180)%360+360)%360-180
        val entry=Entry(sourceId,id,point.latitude(),longitude,clusterId,if(cluster)feature.getNumberProperty("point_count").toLong() else null)
        entries[id]=entry // Deduplicate tile boundaries and wrapped world copies.
      }
    }
    if(sourceRevision==null) return null
    return Layout(sourceRevision,index,entries)
  }
}
