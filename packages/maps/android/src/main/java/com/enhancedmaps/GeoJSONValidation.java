package com.enhancedmaps;

import java.util.HashSet;
import java.util.Set;

/** Strict source framing/geometry checks over the platform JSON tree, without copying it. */
public final class GeoJSONValidation {
  public interface Reader {
    boolean isObject(Object value);
    boolean isArray(Object value);
    boolean isNull(Object value);
    boolean has(Object value, String key);
    Object get(Object value, String key);
    int length(Object value);
    Object at(Object value, int index);
  }
  private final Reader reader;
  private final boolean generatedShape;
  private int positions;
  private GeoJSONValidation(Reader reader,boolean generatedShape) { this.reader=reader;this.generatedShape=generatedShape; }
  private static void require(boolean value, String message) {
    if(!value)throw new IllegalArgumentException(message);
  }
  private int array(Object value, String message) {
    require(reader.isArray(value),message);
    return reader.length(value);
  }
  private void position(Object value) {
    require(array(value,"Invalid GeoJSON position")==2,"GeoJSON position needs exactly two axes");
    Object x=reader.at(value,0), y=reader.at(value,1);
    require(x instanceof Number,"GeoJSON longitude must be a number");
    require(y instanceof Number,"GeoJSON latitude must be a number");
    double longitude=((Number)x).doubleValue(), latitude=((Number)y).doubleValue();
    // At most 10k generated vertices, each unwrapped to its nearest world copy.
    require(Double.isFinite(longitude) && Double.isFinite(latitude) && Math.abs(longitude)<=(generatedShape?1800000:180) && Math.abs(latitude)<=90,"GeoJSON position is outside geographic bounds");
    require(positions<(generatedShape?10000:50000),"GeoJSON position limit exceeded");
    ++positions;
  }
  private void line(Object value, boolean ring) {
    int length=array(value,"Invalid GeoJSON line or ring");
    require(length>=(ring?4:2),"Invalid GeoJSON line or ring");
    for(int i=0;i<length;i++)position(reader.at(value,i));
    if(ring) {
      Object first=reader.at(value,0), last=reader.at(value,length-1);
      require(((Number)reader.at(first,0)).doubleValue()==((Number)reader.at(last,0)).doubleValue() && ((Number)reader.at(first,1)).doubleValue()==((Number)reader.at(last,1)).doubleValue(),"GeoJSON polygon rings must be closed");
    }
  }
  private void polygon(Object value) {
    int length=array(value,"Invalid GeoJSON polygon");
    require(length>0,"GeoJSON polygon needs an exterior ring");
    for(int i=0;i<length;i++)line(reader.at(value,i),true);
  }
  private void geometry(Object value) {
    require(reader.isObject(value),"Expected GeoJSON geometry");
    Object type=reader.get(value,"type"), coordinates=reader.get(value,"coordinates");
    require(!generatedShape || "LineString".equals(type) || "Polygon".equals(type),"Generated shape requires line or polygon geometry");
    if("Point".equals(type))position(coordinates);
    else if("LineString".equals(type))line(coordinates,false);
    else if("Polygon".equals(type))polygon(coordinates);
    else {
      require("MultiPoint".equals(type) || "MultiLineString".equals(type) || "MultiPolygon".equals(type),"Unsupported GeoJSON geometry");
      int length=array(coordinates,"Invalid GeoJSON multi-geometry");
      for(int i=0;i<length;i++) {
        Object part=reader.at(coordinates,i);
        if("MultiPoint".equals(type))position(part);
        else if("MultiLineString".equals(type))line(part,false);
        else polygon(part);
      }
    }
  }
  public static int validate(Object data, Reader reader,boolean generatedShape) {
    require(reader.isObject(data) && "FeatureCollection".equals(reader.get(data,"type")),"Expected GeoJSON FeatureCollection");
    GeoJSONValidation validation=new GeoJSONValidation(reader,generatedShape);
    Object features=reader.get(data,"features");
    int count=validation.array(features,"Expected GeoJSON features array");
    require(count<=(generatedShape?1:10000),"GeoJSON feature limit exceeded");
    Set<String> ids=new HashSet<>();
    for(int i=0;i<count;i++) {
      Object feature=reader.at(features,i);
      require(reader.isObject(feature) && "Feature".equals(reader.get(feature,"type")),"Expected GeoJSON Feature");
      Object id=reader.get(feature,"id");
      // Clustered Marker identifiers include React key paths and Unicode.
      require(id instanceof String && !((String)id).isEmpty() && ((String)id).length()<=512,"Invalid GeoJSON feature ID");
      require(ids.add((String)id),"Duplicate GeoJSON feature ID");
      Object properties=reader.get(feature,"properties");
      require(reader.has(feature,"properties") && (reader.isNull(properties) || reader.isObject(properties)),"GeoJSON properties must be an object or null");
      require(!generatedShape || ("geometry".equals(id) && reader.isNull(properties)),"Invalid generated shape feature");
      validation.geometry(reader.get(feature,"geometry"));
    }
    return validation.positions;
  }
}
