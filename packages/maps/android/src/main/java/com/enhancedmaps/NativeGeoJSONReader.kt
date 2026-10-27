package com.enhancedmaps

import org.json.JSONArray
import org.json.JSONObject

/** Keep JSONObject's raw number/boolean/string distinctions; getDouble coerces strings. */
internal object NativeGeoJSONReader : GeoJSONValidation.Reader {
  override fun isObject(value:Any?)=value is JSONObject
  override fun isArray(value:Any?)=value is JSONArray
  override fun isNull(value:Any?)=value==null || value===JSONObject.NULL
  override fun has(value:Any?,key:String)=(value as JSONObject).has(key)
  override fun get(value:Any?,key:String):Any?=(value as JSONObject).opt(key)
  override fun length(value:Any?)=(value as JSONArray).length()
  override fun at(value:Any?,index:Int):Any?=(value as JSONArray).opt(index)
}
