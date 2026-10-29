import com.enhancedmaps.GeoJSONValidation;
import java.io.DataInputStream;
import java.io.FileInputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public final class GeoJSONValidationTest {
  static final GeoJSONValidation.Reader READER = new GeoJSONValidation.Reader() {
    public boolean isObject(Object value) { return value instanceof Map; }
    public boolean isArray(Object value) { return value instanceof List; }
    public boolean isNull(Object value) { return value == null; }
    public boolean has(Object value, String key) { return ((Map<?,?>) value).containsKey(key); }
    public Object get(Object value, String key) { return ((Map<?,?>) value).get(key); }
    public Iterable<String> keys(Object value) { return ((Map<String,Object>)value).keySet(); }
    public int length(Object value) { return ((List<?>) value).size(); }
    public Object at(Object value, int index) { return ((List<?>) value).get(index); }
  };
  static Object read(DataInputStream input) throws Exception {
    switch (input.readUnsignedByte()) {
      case 0: return null;
      case 1: return false;
      case 2: return true;
      case 3: return input.readDouble();
      case 4: { byte[] bytes = new byte[input.readInt()]; input.readFully(bytes); return new String(bytes, StandardCharsets.UTF_8); }
      case 5: { int count=input.readInt(); List<Object> values=new ArrayList<>(); for(int i=0;i<count;i++) values.add(read(input)); return values; }
      case 6: { int count=input.readInt(); Map<String,Object> values=new HashMap<>(); for(int i=0;i<count;i++)values.put((String)read(input),read(input)); return values; }
      default: throw new AssertionError("Invalid fixture encoding");
    }
  }
  static void check(String label, Object data, Object expected, boolean generatedShape) {
    try {
      int positions=GeoJSONValidation.validate(data,READER,generatedShape);
      if (!(expected instanceof Number) || positions!=((Number)expected).intValue()) throw new AssertionError("Unexpected acceptance/count: "+label);
    } catch(IllegalArgumentException error) {
      if(expected!=null) throw new AssertionError("Unexpected rejection: "+label,error);
      if(error.getMessage()==null || error.getMessage().isEmpty())throw new AssertionError("Missing validation error");
    }
  }
  public static void main(String[] args) throws Exception {
    try(DataInputStream input=new DataInputStream(new FileInputStream(args[0]))) {
      List<?> fixtures=(List<?>)read(input);
      for(Object raw:fixtures) {Map<?,?> fixture=(Map<?,?>)raw;check((String)fixture.get("label"),fixture.get("data"),fixture.get("positions"),Boolean.TRUE.equals(fixture.get("generatedShape")));}
      for(double invalid:new double[]{Double.NaN,Double.POSITIVE_INFINITY,Double.NEGATIVE_INFINITY}) {
        Object geometry=Map.of("type","Point","coordinates",List.of(invalid,0));
        Object feature=Map.of("type","Feature","id","nonfinite","properties",Map.of(),"geometry",geometry);
        check("nonfinite axis",Map.of("type","FeatureCollection","features",List.of(feature)),null,false);
      }
      System.out.println("Java GeoJSON validation: "+fixtures.size()+" shared fixtures and nonfinite axes");
    }
  }
}
