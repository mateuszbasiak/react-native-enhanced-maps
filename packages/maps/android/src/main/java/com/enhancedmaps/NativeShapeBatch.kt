package com.enhancedmaps

import org.json.JSONObject
import org.maplibre.android.style.expressions.Expression.*
import org.maplibre.android.style.layers.*
import org.maplibre.android.style.layers.PropertyFactory.*

internal object NativeShapeBatch {
  fun apply(layer:Layer,definition:JSONObject) {
    if(!definition.has("shapeGroup"))return
    val visible=eq(get("__shape_visible"),literal(true))
    when(layer) {
      is FillLayer -> {
        layer.setFilter(visible)
        layer.setProperties(fillSortKey(get("__shape_order")),fillColor(toColor(get("__shape_fill"))),fillOpacity(get("__shape_opacity")))
      }
      is LineLayer -> {
        layer.setFilter(all(visible,eq(get("__shape_line_group"),literal(definition.getInt("shapeGroup")))))
        layer.setProperties(lineSortKey(get("__shape_order")),lineColor(toColor(get("__shape_stroke"))),lineWidth(get("__shape_width")),lineOpacity(get("__shape_opacity")))
      }
    }
  }
}
