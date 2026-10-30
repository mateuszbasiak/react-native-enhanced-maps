#include "../../packages/maps/cpp/SceneJSONDepth.h"
#include <cstdint>
#include <fstream>
#include <iostream>
#include <stdexcept>
#include <string>

static uint32_t read32(std::ifstream &in) {
  uint32_t n = 0;
  for (int i = 0; i < 4; i++) {
    int b = in.get();
    if (b < 0) throw std::runtime_error("Truncated corpus");
    n = (n << 8) | static_cast<uint32_t>(b);
  }
  return n;
}
int main(int argc, char **argv) {
  if (argc != 2) return 2;
  std::ifstream in(argv[1], std::ios::binary);
  const auto count = read32(in);
  for (uint32_t i = 0; i < count; i++) {
    const auto size = read32(in);
    const bool expected = in.get() == 1;
    std::string input(size, '\0');
    in.read(input.data(), size);
    if (!in || enhancedmaps::sceneJSONDepthAllowed(input) != expected) {
      std::cerr << "Depth fixture " << i << "\n";
      return 1;
    }
  }
  return in.peek() == std::char_traits<char>::eof() ? 0 : 3;
}
