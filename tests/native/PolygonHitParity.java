import java.util.Scanner;

/** Host adapter; all geometry decisions use the production Android helper. */
public final class PolygonHitParity {
  public static void main(String[] args) {
    Scanner input=new Scanner(System.in);
    int count=input.nextInt();
    for(int i=0;i<count;i++) {
      double longitude=Double.parseDouble(input.next()),latitude=Double.parseDouble(input.next());
      int rings=input.nextInt();
      double[][][] polygon=new double[rings][][];
      for(int r=0;r<rings;r++) {
        int positions=input.nextInt();
        polygon[r]=new double[positions][2];
        for(int p=0;p<positions;p++) {
          polygon[r][p][0]=Double.parseDouble(input.next());
          polygon[r][p][1]=Double.parseDouble(input.next());
        }
      }
      System.out.println(com.enhancedmaps.PolygonHitTest.contains(longitude,latitude,polygon)?1:0);
    }
  }
}
