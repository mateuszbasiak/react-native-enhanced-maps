#pragma once
#include <cmath>
#include <optional>
#include <stdexcept>
#include <string>
#include <unordered_map>
#include <vector>

namespace enhancedmaps {
struct RevisionedSource {
  std::string id;
  std::optional<double> revision;
  std::string data;
};
/** Map-owned, UI-thread-only accepted source state. Validation never advances state. */
class SourceRevisionGate {
 public:
  void validate(const std::vector<RevisionedSource> &sources) const {
    if (closed_) throw std::logic_error("Map source state is disposed");
    std::unordered_map<std::string, const RevisionedSource *> next;
    for (const auto &source : sources) {
      if (source.id.empty() || !next.emplace(source.id, &source).second)
        throw std::invalid_argument("Invalid or duplicate source ID");
      auto revision = source.revision;
      if (revision && (!std::isfinite(*revision) || *revision < 0 || *revision > 9007199254740991. || *revision != std::floor(*revision)))
        throw std::invalid_argument("Source revision must be a non-negative safe integer");
      auto found = accepted_.find(source.id);
      if (found == accepted_.end() || !found->second.revision) continue;
      const auto &old = found->second;
      if (!revision || *revision < *old.revision || (*revision == *old.revision && source.data != old.data))
        throw std::invalid_argument("Source " + source.id + " data replacement requires an increased revision");
    }
  }
  void commit(const std::vector<RevisionedSource> &sources) {
    validate(sources);
    std::unordered_map<std::string, RevisionedSource> next;
    for (const auto &source : sources) next.emplace(source.id, source);
    accepted_ = std::move(next);
  }
  void close() { closed_ = true; accepted_.clear(); }
 private:
  bool closed_ = false;
  std::unordered_map<std::string, RevisionedSource> accepted_;
};
}
