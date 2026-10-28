package com.enhancedmaps

import org.json.JSONArray
import org.json.JSONObject
import org.maplibre.android.style.expressions.Expression
import org.maplibre.android.style.layers.HeatmapLayer
import org.maplibre.android.style.layers.PropertyFactory.*

/** Package-owned expressions built only from the preflighted literal gradient. */
internal object NativeHeatmap {
  fun layer(id:String,source:String,style:JSONObject):HeatmapLayer {
    val expression=JSONArray().put("interpolate").put(JSONArray().put("linear")).put(JSONArray().put("heatmap-density"))
    val stops=style.getJSONArray("heatmapGradient")
    for(i in 0 until stops.length()) {
      val stop=stops.getJSONArray(i)
      expression.put(stop.getDouble(0)).put(JSONArray().put("to-color").put(stop.getString(1)))
    }
    return HeatmapLayer(id,source).withProperties(
      heatmapRadius(style.getDouble("heatmapRadius").toFloat()),
      heatmapOpacity(style.getDouble("heatmapOpacity").toFloat()),
      heatmapWeight(Expression.get("weight")),heatmapColor(Expression.raw(expression.toString())))
  }
}
