#pragma once
#include <array>
#include <cmath>
#include <optional>
#include <vector>
namespace enhancedmaps {
struct GestureSample { int kind, phase; double id, timestampMs, x, y; };
// UI-thread gate, four fixed slots, no queues. Only emitted samples leave the gate.
class GestureEventGate {
  struct Slot { bool active=false; double id=0, lastEmission=0, x=0, y=0; };
  std::array<Slot,4> slots_;
  double sequence_=0;
 public:
  std::optional<GestureSample> next(int kind,int phase,double time,double x,double y,bool enabled,double interval) {
    if(!enabled) { reset();return std::nullopt; }
    if(kind<0 || kind>=4 || phase<0 || phase>=4 || !std::isfinite(time) || time<0 || !std::isfinite(x) || !std::isfinite(y) || !std::isfinite(interval) || interval<16 || interval>1000)return std::nullopt;
    auto &slot=slots_[kind];
    if(phase==0) {
      if(slot.active || sequence_>=9007199254740991.)return std::nullopt;
      slot.active=true;slot.id=++sequence_;
    } else if(!slot.active)return std::nullopt;
    slot.x=x;slot.y=y;
    if(phase==1 && time-slot.lastEmission<interval)return std::nullopt;
    slot.lastEmission=time;
    if(phase==2 || phase==3)slot.active=false;
    return GestureSample{kind,phase,slot.id,time,x,y};
  }
  std::vector<GestureSample> cancelAll(double time) {
    std::vector<GestureSample> result;
    if(std::isfinite(time) && time>=0)for(int kind=0;kind<4;kind++) {
      const auto &slot=slots_[kind];
      if(slot.active)result.push_back({kind,3,slot.id,time,slot.x,slot.y});
    }
    reset();return result;
  }
  void reset() { for(auto &slot:slots_)slot.active=false; }
};
}
