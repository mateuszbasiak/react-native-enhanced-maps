#pragma once
#include <array>
#include <stdexcept>
namespace enhancedmaps {
// Caller holds its platform mutex. The front slot remains pinned between draws.
class PrototypeOutputSlots {
  struct Slot { bool writing=false; unsigned readers=0; };
  std::array<Slot,3> slots{};
  int front=-1;
  bool closed=false;
public:
  int acquire() {
    if(closed)return -1;
    for(int i=0;i<3;i++)if(i!=front && !slots[i].writing && slots[i].readers==0) { slots[i].writing=true;return i; }
    return -1;
  }
  bool publish(int i) {
    if(i<0 || i>=3 || !slots[i].writing)throw std::invalid_argument("Invalid output lease");
    slots[i].writing=false;
    if(closed)return false;
    front=i;return true;
  }
  int beginRead() { if(closed || front<0)return -1;slots[front].readers++;return front; }
  void endRead(int i) {
    if(i<0 || i>=3 || slots[i].readers==0)throw std::invalid_argument("Invalid output read");
    slots[i].readers--;
  }
  void close() { closed=true;front=-1; }
};
}
