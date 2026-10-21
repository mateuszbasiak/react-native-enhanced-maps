#include "SourceRevisionGate.h"
#include <cassert>
#include <limits>
#include <stdexcept>
using enhancedmaps::SourceRevisionGate;
using enhancedmaps::RevisionedSource;
template <typename F> void reject(F action) { bool rejected=false; try { action(); } catch (const std::exception &) { rejected=true; } assert(rejected); }
int main() {
  SourceRevisionGate gate;
  gate.commit({{"a", 2, "A"}, {"b", 1, "B"}});
  gate.validate({{"a", 2, "A"}, {"b", 1, "B"}});
  reject([&] { gate.validate({{"a", 1, "old"}}); });
  reject([&] { gate.validate({{"a", 2, "changed"}}); });
  reject([&] { gate.validate({{"a", std::nullopt, "A"}}); });
  reject([&] { gate.commit({{"a", 3, "new"}, {"b", 0, "old"}}); });
  gate.validate({{"a", 3, "new"}, {"b", 1, "B"}});
  gate.commit({{"a", 2, "A"}, {"b", 1, "B"}});
  gate.commit({{"a", 3, "new"}});
  reject([&] { gate.validate({{"a", 2, "A"}}); });
  gate.commit({}); gate.commit({{"a", 0, "restart"}});
  SourceRevisionGate other;
  other.commit({{"a", std::nullopt, "first"}});
  other.commit({{"a", std::nullopt, "second"}});
  other.commit({{"a", 0, "opt-in"}});
  reject([&] { other.validate({{"a", -0., "changed"}}); });
  for (double invalid : {-1., .5, std::numeric_limits<double>::quiet_NaN(), std::numeric_limits<double>::infinity(), 9007199254740992.})
    reject([&] { other.validate({{"invalid", invalid, "data"}}); });
  other.validate({{"max", 9007199254740991., "data"}});
  reject([&] { other.validate({{"duplicate", 0, "A"}, {"duplicate", 0, "A"}}); });
  gate.close(); gate.close();
  reject([&] { gate.validate({}); });
  reject([&] { gate.commit({{"a", 10, "late"}}); });
}
