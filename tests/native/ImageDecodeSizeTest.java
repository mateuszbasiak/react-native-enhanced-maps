import com.enhancedmaps.ImageDecodeSize;
import com.enhancedmaps.OverlayImagePath;
public class ImageDecodeSizeTest {
  static void equal(int expected,int actual){if(expected!=actual)throw new AssertionError(expected+" != "+actual);}
  public static void main(String[] args){
    equal(1,ImageDecodeSize.sample(32,32,16384));
    equal(1,ImageDecodeSize.sample(16384,1,16384));
    equal(2,ImageDecodeSize.sample(16385,1,16384));
    equal(4,ImageDecodeSize.sample(1,32769,16384));
    equal(8,ImageDecodeSize.sample(65535,32768,8192));
    equal(2,ImageDecodeSize.next(1));equal(4,ImageDecodeSize.next(2));
    equal(1<<30,ImageDecodeSize.sample(Integer.MAX_VALUE,1,2));
    for(int[] invalid:new int[][]{{0,1,1},{1,-1,1},{1,1,0}}){
      try{ImageDecodeSize.sample(invalid[0],invalid[1],invalid[2]);throw new AssertionError("accepted invalid dimensions");}catch(IllegalArgumentException expected){}
    }
    try{ImageDecodeSize.next(1<<30);throw new AssertionError("overflow");}catch(IllegalArgumentException expected){}
    for(String[] fixture:new String[][]{
      {"asset://overlays/weather.png","overlays/weather.png"},
      {"asset://weather.png","weather.png"},
      {"asset:///overlays/weather.png","overlays/weather.png"},
      {"asset://overlays/weather%20v1+.png?cache=1#version","overlays/weather v1+.png"},
      {"asset://overlays/%E6%B0%B4.png","overlays/水.png"}
    })if(!fixture[1].equals(OverlayImagePath.asset(fixture[0])))throw new AssertionError("asset path "+fixture[0]);
    for(String invalid:new String[]{"asset:///","file:///weather.png"}){
      try{OverlayImagePath.asset(invalid);throw new AssertionError("accepted invalid asset");}catch(IllegalArgumentException expected){}
    }
    System.out.println("Image dimension and allocation retry policy passed");
  }
}
