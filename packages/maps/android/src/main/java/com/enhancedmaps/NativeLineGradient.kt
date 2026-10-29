package com.enhancedmaps

import org.json.JSONArray
import org.json.JSONObject
import org.maplibre.android.style.expressions.Expression

/** A validated gradient expression, never an arbitrary scene-supplied expression. */
internal object NativeLineGradient {
  private val colorPattern=Regex("^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$")
  fun parse(style:JSONObject?):Expression? {
    if(style==null || !style.has("lineGradient"))return null
    require(!style.has("lineDasharray") && !style.has("linePattern")) { "Gradient strokes cannot use dash or image patterns" }
    val stops=style.getJSONArray("lineGradient")
    require(stops.length()>=2) { "Invalid gradient stop count" }
    val expression=JSONArray().put("interpolate").put(JSONArray().put("linear")).put(JSONArray().put("line-progress"))
    var previous=-1.0
    for(i in 0 until stops.length()) {
      val stop=stops.getJSONArray(i)
      require(stop.length()==2) { "Invalid gradient stop" }
      val raw=stop.get(0)
      require(raw is Number) { "Invalid gradient offset" }
      val offset=raw.toDouble()
      require(offset.isFinite() && offset in 0.0..1.0 && offset>previous && (i!=0 || offset==0.0) && (i!=stops.length()-1 || offset==1.0)) { "Invalid gradient offset" }
      val color=stop.get(1)
      require(color is String && colorPattern.matches(color)) { "Invalid gradient color" }
      expression.put(offset).put(JSONArray().put("to-color").put(color))
      previous=offset
    }
    return Expression.raw(expression.toString())
  }
}
