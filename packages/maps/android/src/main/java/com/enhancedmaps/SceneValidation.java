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
  private void image(Object source){
    for(String key:r.keys(source))require(Set.of("id","type","tileKind","uri","coordinates").contains(key),"Unsupported image source field");
    Object uri=r.get(source,"uri");require(uri instanceof String && ((String)uri).length()<=4096 && ((String)uri).matches("(?:https?://[^\\s]+|file:///[^\\s]+|asset://[^\\s]+|[a-z][a-z0-9_]*)"),"Invalid image URI");
    Object corners=r.get(source,"coordinates");require(array(corners,"Invalid image coordinates")==4,"Invalid image coordinates");
    for(int i=0;i<4;i++){Object c=r.at(corners,i);require(array(c,"Invalid image coordinate")==2,"Invalid image coordinate");number(r.at(c,0),-540,540);number(r.at(c,1),-85,85);}
  }
  private void raster(Object source){
    if("image".equals(r.get(source,"tileKind"))){image(source);return;}
    for(String key:r.keys(source))require(Set.of("id","type","revision","urlTemplate","tileSize","minZoom","maxZoom","tileKind").contains(key),"Unsupported raster source field");
    Object raw=r.get(source,"urlTemplate");require(raw instanceof String,"Invalid raster URL template");String url=(String)raw;
    String kind=r.has(source,"tileKind")?String.valueOf(r.get(source,"tileKind")):"xyz";
    require(Set.of("xyz","wms","local").contains(kind),"Invalid raster tile kind");
    boolean local=kind.equals("local"),wms=kind.equals("wms");
    String pattern=local?"(?:file:///|asset://)[^\\s?#]+":"https?://[^/\\s{}?#]+/[^\\s#]*";
    String remaining=wms?url.replace("{bbox-epsg-3857}",""):url.replaceAll("\\{[xyz]\\}","");
    require(url.length()<=4096 && url.matches(pattern) && (wms?url.contains("{bbox-epsg-3857}"):url.contains("{x}")&&url.contains("{y}")&&url.contains("{z}")) && !remaining.matches("(?s).*[{}].*"),"Invalid raster URL template");
    double size=number(r.get(source,"tileSize"),64,1024);require(size%1==0 && (((int)size)&((int)size-1))==0,"Invalid raster tile size");
    double min=number(r.get(source,"minZoom"),0,22),max=number(r.get(source,"maxZoom"),0,22);require(min%1==0 && max%1==0 && min<=max,"Invalid raster zoom bounds");
  }
  private void style(Object value,String type){
    require(r.isObject(value),"Invalid layer style");
    Set<String> allowed=type.equals("heatmap")?Set.of("heatmapRadius","heatmapOpacity","heatmapGradient"):type.equals("raster")?Set.of("rasterOpacity"):type.equals("circle")?Set.of("circleRadius","circleColor","circleOpacity"):type.equals("fill")?Set.of("fillColor","fillOpacity"):Set.of("lineColor","lineWidth","lineOpacity","lineCap","lineJoin","lineMiterLimit","lineDasharray","lineGradient");
    for(String key:r.keys(value)){
      require(allowed.contains(key),"Unsupported layer style");Object v=r.get(value,key);
      if(key.endsWith("Color"))require(v instanceof String && COLOR.matcher((String)v).matches(),"Invalid layer color");
      else if(key.equals("lineCap"))require(v instanceof String && Set.of("butt","round","square").contains(v),"Invalid line cap");
      else if(key.equals("lineJoin"))require(v instanceof String && Set.of("miter","round","bevel").contains(v),"Invalid line join");
      else if(key.equals("lineDasharray")){int n=array(v,"Invalid line dash pattern");require(n>=2 && n<=32 && n%2==0,"Invalid line dash pattern");for(int i=0;i<n;i++)require(number(r.at(v,i),0,10000000)>0,"Invalid line dash pattern");}
      else if(key.equals("lineGradient") || key.equals("heatmapGradient")){
        int n=array(v,"Invalid line gradient");require((type.equals("line") || type.equals("heatmap")) && n>=2 && (!type.equals("heatmap") || n<=1024),"Invalid line gradient");double previous=-1;
        for(int i=0;i<n;i++){Object stop=r.at(v,i);require(array(stop,"Invalid line gradient")==2,"Invalid line gradient");double offset=number(r.at(stop,0),0,1);Object color=r.at(stop,1);
          require(offset>previous && (i!=0 || offset==0) && (i!=n-1 || offset==1) && color instanceof String && COLOR.matcher((String)color).matches(),"Invalid line gradient");previous=offset;}
      }
      else number(v,key.equals("heatmapRadius")?10:0,key.endsWith("Opacity")?1:key.equals("heatmapRadius")?50:key.equals("lineMiterLimit")?1000:256);
    }
  }
  public static void validate(Object scene,Reader reader,Set<String> externalSources,Set<String> externalLayers){new SceneValidation(reader).check(scene,externalSources,externalLayers);}
  private void check(Object scene,Set<String> externalSources,Set<String> externalLayers){
    require(r.isObject(scene),"Invalid scene JSON");Object sources=r.get(scene,"sources"),layers=r.get(scene,"layers");
    int ns=array(sources,"Invalid scene sources"),nl=array(layers,"Invalid scene layers");
    Map<String,Object> sourceMap=new HashMap<>();
    int images=0;
    for(int i=0;i<ns;i++){Object s=r.at(sources,i);require(r.isObject(s),"Invalid scene source");String id=name(r.get(s,"id"),128);require(!externalSources.contains(id),"Scene source ID collides with existing style");require(sourceMap.put(id,s)==null,"Duplicate scene source ID");require(!r.has(s,"type") || Set.of("geojson","raster").contains(r.get(s,"type")),"Unsupported source type");if("raster".equals(r.get(s,"type")))raster(s);if("image".equals(r.get(s,"tileKind")))require(++images<=8,"Image source limit exceeded");}
    Set<String> ids=new HashSet<>(),inserted=new HashSet<>(externalLayers);
    for(int i=0;i<nl;i++){Object l=r.at(layers,i);require(r.isObject(l),"Invalid scene layer");String id=name(r.get(l,"id"),135);require(!externalLayers.contains(id),"Scene layer ID collides with existing style");require(ids.add(id),"Duplicate scene layer ID");
      Object rawType=r.get(l,"type");require(rawType instanceof String && Set.of("circle","line","fill","raster","heatmap").contains(rawType),"Unsupported layer type");String type=(String)rawType;
      String source=name(r.get(l,"source"),128);require(sourceMap.containsKey(source),"Layer references missing source");
      if(r.has(l,"shapeGroup")) {
        double group=number(r.get(l,"shapeGroup"),0,9007199254740991.0);
        require(Math.floor(group)==group && Set.of("line","fill").contains(type) && "unwrapped".equals(r.get(sourceMap.get(source),"coordinateSpace")) && !r.has(l,"clusterFilter"),"Invalid shape batch layer");
        Object data=r.get(sourceMap.get(source),"data"),features=r.get(data,"features");int count=array(features,"Invalid shape batch features");
        for(int j=0;j<count;j++){Object p=r.get(r.at(features,j),"properties");require(r.isObject(p) && r.has(p,"__shape_order"),"Invalid shape batch feature");}
      }
      boolean rasterSource="raster".equals(r.get(sourceMap.get(source),"type"));require(type.equals("raster")==rasterSource,"Layer/source type mismatch");
      if(rasterSource)require(!Boolean.TRUE.equals(r.get(l,"interactive")) && !r.has(l,"clusterFilter"),"Raster layers cannot be interactive or clustered");
      if(r.has(l,"beforeId")){String before=name(r.get(l,"beforeId"),135);require(!before.equals(id) && inserted.contains(before),"Invalid layer insertion reference");}
      for(String key:List.of("visible","interactive"))require(!r.has(l,key) || r.get(l,key) instanceof Boolean,"Invalid layer boolean");
      if(r.has(l,"clusterFilter")){Object f=r.get(l,"clusterFilter");require("clusters".equals(f)||"points".equals(f),"Invalid cluster filter");require(r.isObject(r.get(sourceMap.get(source),"cluster")),"Cluster filter requires clustered source");}
      if(type.equals("heatmap")){
        Object src=sourceMap.get(source);require(!r.has(src,"cluster"),"Heatmap cannot use a clustered source");
        Object data=r.get(src,"data"),features=r.get(data,"features");int nf=array(features,"Invalid heatmap features");
        for(int j=0;j<nf;j++){Object f=r.at(features,j),g=r.get(f,"geometry"),p=r.get(f,"properties");require("Point".equals(r.get(g,"type")),"Heatmap requires Point geometry");number(r.get(p,"weight"),0,1000000);}
        require(!r.has(l,"interactive") || Boolean.FALSE.equals(r.get(l,"interactive")),"Heatmap is not interactive");
        Object st=r.get(l,"style");require(r.isObject(st) && r.has(st,"heatmapRadius") && r.has(st,"heatmapOpacity") && r.has(st,"heatmapGradient"),"Incomplete heatmap style");
      }
      if(r.has(l,"style"))style(r.get(l,"style"),type);
      inserted.add(id);
    }
  }
}
