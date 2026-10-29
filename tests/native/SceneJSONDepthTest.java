import com.enhancedmaps.SceneJSONDepth;
import java.io.DataInputStream;
import java.io.FileInputStream;
import java.nio.charset.StandardCharsets;
public final class SceneJSONDepthTest {
 public static void main(String[] args) throws Exception {
  try(DataInputStream in=new DataInputStream(new FileInputStream(args[0]))) {
   int count=in.readInt();
   for(int i=0;i<count;i++) {
    int size=in.readInt(); boolean expected=in.readBoolean(); byte[] bytes=new byte[size]; in.readFully(bytes);
    if(SceneJSONDepth.allowed(new String(bytes,StandardCharsets.UTF_8))!=expected)throw new AssertionError("Depth fixture "+i);
   }
   if(in.read()!=-1)throw new AssertionError("Unconsumed corpus");
  }
 }
}
