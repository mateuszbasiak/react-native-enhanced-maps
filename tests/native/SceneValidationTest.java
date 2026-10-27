import com.enhancedmaps.SceneValidation;
import java.io.*;
import java.util.*;
public final class SceneValidationTest {
  static final SceneValidation.Reader READER = new SceneValidation.Reader() {
    public boolean isObject(Object v){return v instanceof Map;}
    public boolean isArray(Object v){return v instanceof List;}
    public boolean isNull(Object v){return v==null;}
    public boolean has(Object v,String k){return ((Map<?,?>)v).containsKey(k);}
    public Object get(Object v,String k){return ((Map<?,?>)v).get(k);}
    public int length(Object v){return ((List<?>)v).size();}
    public Object at(Object v,int i){return ((List<?>)v).get(i);}
    public Iterable<String> keys(Object v){return ((Map<String,Object>)v).keySet();}
  };
  public static void main(String[] args)throws Exception {
    try(DataInputStream in=new DataInputStream(new FileInputStream(args[0]))) {
      List<?> fixtures=(List<?>)GeoJSONValidationTest.read(in);
      for(Object raw:fixtures){Map<?,?> f=(Map<?,?>)raw;boolean accepted=true;
        Set<String> sources=new HashSet<>((List<String>)f.getOrDefault("externalSources",null)==null?List.of():(List<String>)f.get("externalSources"));
        Set<String> layers=new HashSet<>((List<String>)f.getOrDefault("externalLayers",null)==null?List.of():(List<String>)f.get("externalLayers"));
        try{SceneValidation.validate(f.get("scene"),READER,sources,layers);}catch(IllegalArgumentException error){accepted=false;}
        if(accepted!=Boolean.TRUE.equals(f.get("accepted")))throw new AssertionError(f.get("label"));
      }
      System.out.println("Scene validation: "+fixtures.size()+" fixtures");
    }
  }
}
