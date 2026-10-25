#include "PolygonHitTest.h"
#include <iostream>
#include <stdexcept>
#include <string>

static double number() {
  std::string token;
  if (!(std::cin >> token)) throw std::runtime_error("Missing fixture coordinate");
  return std::stod(token);
}
int main() {
  int count;
  if (!(std::cin >> count)) return 1;
  for (int i=0;i<count;i++) {
    const double longitude=number(),latitude=number();
    int rings;
    std::cin >> rings;
    enhancedmaps::HitPolygon polygon;
    for (int r=0;r<rings;r++) {
      int positions;
      std::cin >> positions;
      enhancedmaps::HitRing ring;
      for (int p=0;p<positions;p++) {
        const double x=number(),y=number();
        ring.push_back({x,y});
      }
      polygon.push_back(ring);
    }
    std::cout << (enhancedmaps::containsFilledPolygon(longitude,latitude,polygon)?1:0) << '\n';
  }
}
