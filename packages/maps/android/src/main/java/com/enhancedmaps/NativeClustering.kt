package com.enhancedmaps

import org.json.JSONObject
import org.maplibre.geojson.FeatureCollection
import org.maplibre.android.style.sources.GeoJsonOptions
import org.maplibre.android.style.expressions.Expression

internal object NativeClustering {
  const val INDEX_PROPERTY="__enhanced_maps_cluster_index"
  data class Source(val id:String,val data:FeatureCollection,val options:GeoJsonOptions,val identity:String,val positions:Int,val generatedShape:Boolean)
  fun parse(source:JSONObject,indexRevision:Long):Source {
    val raw=source.getJSONObject("data")
    require(!source.has("coordinateSpace") || source.opt("coordinateSpace")=="unwrapped") { "Invalid source coordinate space" }
    val generatedShape=source.opt("coordinateSpace")=="unwrapped"
    require(!generatedShape || !source.has("cluster")) { "Generated shapes cannot use clustering" }
    val positions=GeoJSONValidation.validate(raw,NativeGeoJSONReader,generatedShape)
    val options=GeoJsonOptions().withSynchronousUpdate(true)
    var identity=raw.toString()
    if(generatedShape)identity+="\ncoordinateSpace:unwrapped"
    if(source.has("lineMetrics")) {
      val metrics=source.get("lineMetrics")
      require(metrics is Boolean) { "Line metrics must be boolean" }
      require(!metrics || !source.has("cluster")) { "Line metrics cannot use clustering" }
      options.withLineMetrics(metrics)
      if(metrics)identity+="\nlineMetrics:true"
    }
    if(source.has("cluster")) {
      val cluster=source.getJSONObject("cluster")
      require(cluster.keys().asSequence().toSet()==setOf("radius","maxZoom","minPoints")) { "Invalid cluster options" }
      fun integer(key:String,min:Int,max:Int):Int {
        val value=cluster.get(key)
        require(value is Number && value.toDouble().isFinite() && value.toDouble()%1==0.0 && value.toDouble() in min.toDouble()..max.toDouble()) { "Invalid cluster $key" }
        return value.toInt()
      }
      val radius=integer("radius",1,512);val zoom=integer("maxZoom",0,17);val minimum=integer("minPoints",2,Int.MAX_VALUE)
      val features=raw.getJSONArray("features")
      for(i in 0 until features.length()) {
        val feature=features.getJSONObject(i)
        require(feature.getJSONObject("geometry").getString("type")=="Point") { "Clustered sources require Point features" }
        val properties=feature.optJSONObject("properties")
        require(listOf("cluster","cluster_id","point_count","point_count_abbreviated",INDEX_PROPERTY).none { properties?.has(it)==true }) { "Reserved cluster input property" }
      }
      options.withCluster(true).withClusterRadius(radius).withClusterMaxZoom(zoom).withClusterMinPoints(minimum)
      options.withClusterProperty(INDEX_PROPERTY,Expression.literal("max"),Expression.get(INDEX_PROPERTY))
      identity+="\ncluster:$radius:$zoom:$minimum"
    }
    val data=FeatureCollection.fromJson(raw.toString())
    if(source.has("cluster"))data.features()?.forEach { it.addNumberProperty(INDEX_PROPERTY,indexRevision) }
    return Source(source.getString("id"),data,options,identity,positions,generatedShape)
  }
}
