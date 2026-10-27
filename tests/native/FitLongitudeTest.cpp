#include "FitLongitude.h"
#include <cassert>
#include <cmath>
#include <limits>
#include <initializer_list>
int main() {
  const double copies[][2]={{180.1,-179.9},{-180.1,179.9},{540.1,-179.9},{-540.1,179.9},{180,180},{-180,-180},{1800000,0},{-1800000,0}};
  double output;
  for (auto &pair:copies) { assert(EMFitLongitude(pair[0],true,output)); assert(std::abs(output-pair[1])<1e-9); }
  for (double value:{-180.,-1.,0.,1.,180.}) {assert(EMFitLongitude(value,false,output)); assert(output==value);}
  for (double value:{180.1,-180.1,540.1,-540.1}) assert(!EMFitLongitude(value,false,output));
  for (bool scene:{false,true}) for(double value:{std::numeric_limits<double>::quiet_NaN(),std::numeric_limits<double>::infinity(),-std::numeric_limits<double>::infinity()}) assert(!EMFitLongitude(value,scene,output));
}
