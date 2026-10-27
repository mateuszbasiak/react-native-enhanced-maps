package com.enhancedmaps;

import java.util.*;
import java.util.regex.Pattern;

/** Preflight the private scene graph and literal styles before any SDK style mutation. */
public final class SceneValidation {
  public interface Reader extends GeoJSONValidation.Reader { Iterable<String> keys(Object value); }
  private static final Pattern NAME=Pattern.compile("[A-Za-z0-9_.:-]+");
  private static final Pattern COLOR=Pattern.compile("#[A-Fa-f0-9]{6}([A-Fa-f0-9]{2})?");
  private final Reader r;
  private SceneValidation(Reader reader){r=reader;}
  private static void require(boolean valid,String message){if(!valid)throw new IllegalArgumentException(message);}
  private String name(Object value,int max){require(value instanceof String && ((String)value).length()<=max && NAME.matcher((String)value).matches(),"Invalid scene resource ID");return (String)value;}
  private int array(Object value,String message){require(r.isArray(value),message);return r.length(value);}
  private double number(Object value,double min,double max){require(value instanceof Number,"Invalid layer style number");double n=((Number)value).doubleValue();require(Double.isFinite(n) && n>=min && n<=max,"Invalid layer style number");return n;}
  private void style(Object value,String type){
    require(r.isObject(value),"Invalid layer style");
    Set<String> allowed=type.equals("circle")?Set.of("circleRadius","circleColor","circleOpacity"):type.equals("fill")?Set.of("fillColor","fillOpacity"):Set.of("lineColor","lineWidth","lineOpacity","lineCap","lineJoin","lineMiterLimit","lineDasharray","lineGradient");
    for(String key:r.keys(value)){
      require(allowed.contains(key),"Unsupported layer style");Object v=r.get(value,key);
      if(key.endsWith("Color"))require(v instanceof String && COLOR.matcher((String)v).matches(),"Invalid layer color");
      else if(key.equals("lineCap"))require(v instanceof String && Set.of("butt","round","square").contains(v),"Invalid line cap");
      else if(key.equals("lineJoin"))require(v instanceof String && Set.of("miter","round","bevel").contains(v),"Invalid line join");
      else if(key.equals("lineDasharray")){int n=array(v,"Invalid line dash pattern");require(n>=2 && n<=32 && n%2==0,"Invalid line dash pattern");for(int i=0;i<n;i++)require(number(r.at(v,i),0,10000000)>0,"Invalid line dash pattern");}
      else if(key.equals("lineGradient")){
        int n=array(v,"Invalid line gradient");require(type.equals("line") && n>=2 && n<=10000,"Invalid line gradient");double previous=-1;
        for(int i=0;i<n;i++){Object stop=r.at(v,i);require(array(stop,"Invalid line gradient")==2,"Invalid line gradient");double offset=number(r.at(stop,0),0,1);Object color=r.at(stop,1);
          require(offset>previous && (i!=0 || offset==0) && (i!=n-1 || offset==1) && color instanceof String && COLOR.matcher((String)color).matches(),"Invalid line gradient");previous=offset;}
      }
      else number(v,0,key.endsWith("Opacity")?1:key.equals("lineMiterLimit")?1000:256);
    }
  }
  public static void validate(Object scene,Reader reader,Set<String> externalSources,Set<String> externalLayers){new SceneValidation(reader).check(scene,externalSources,externalLayers);}
  private void check(Object scene,Set<String> externalSources,Set<String> externalLayers){
    require(r.isObject(scene),"Invalid scene JSON");Object sources=r.get(scene,"sources"),layers=r.get(scene,"layers");
    int ns=array(sources,"Invalid scene sources"),nl=array(layers,"Invalid scene layers");require(ns<=64 && nl<=128,"Map scene resource limit exceeded");
    Map<String,Object> sourceMap=new HashMap<>();
    for(int i=0;i<ns;i++){Object s=r.at(sources,i);require(r.isObject(s),"Invalid scene source");String id=name(r.get(s,"id"),128);require(!externalSources.contains(id),"Scene source ID collides with existing style");require(sourceMap.put(id,s)==null,"Duplicate scene source ID");require(!r.has(s,"type") || "geojson".equals(r.get(s,"type")),"Unsupported source type");}
    Set<String> ids=new HashSet<>(),inserted=new HashSet<>(externalLayers);
    for(int i=0;i<nl;i++){Object l=r.at(layers,i);require(r.isObject(l),"Invalid scene layer");String id=name(r.get(l,"id"),135);require(!externalLayers.contains(id),"Scene layer ID collides with existing style");require(ids.add(id),"Duplicate scene layer ID");
      Object rawType=r.get(l,"type");require(rawType instanceof String && Set.of("circle","line","fill").contains(rawType),"Unsupported layer type");String type=(String)rawType;
      String source=name(r.get(l,"source"),128);require(sourceMap.containsKey(source),"Layer references missing source");
      if(r.has(l,"beforeId")){String before=name(r.get(l,"beforeId"),135);require(!before.equals(id) && inserted.contains(before),"Invalid layer insertion reference");}
      for(String key:List.of("visible","interactive"))require(!r.has(l,key) || r.get(l,key) instanceof Boolean,"Invalid layer boolean");
      if(r.has(l,"clusterFilter")){Object f=r.get(l,"clusterFilter");require("clusters".equals(f)||"points".equals(f),"Invalid cluster filter");require(r.isObject(r.get(sourceMap.get(source),"cluster")),"Cluster filter requires clustered source");}
      if(r.has(l,"style"))style(r.get(l,"style"),type);
      inserted.add(id);
    }
  }
}
