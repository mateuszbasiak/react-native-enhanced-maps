#pragma once
#include <string_view>

namespace enhancedmaps {
namespace scene_json_depth {
inline bool separator(char c) {
  return c==' ' || c=='\t' || c=='\r' || c=='\n' || c=='{' || c=='}' || c=='[' || c==']' || c==',' || c==':';
}
inline bool digit(char c) { return c>='0' && c<='9'; }
inline bool literal(std::string_view token) {
  if(token=="true" || token=="false" || token=="null")return true;
  std::size_t i=0;
  if(i<token.size() && token[i]=='-')++i;
  if(i==token.size())return false;
  if(token[i]=='0')++i;
  else {
    if(token[i]<'1' || token[i]>'9')return false;
    do {++i;} while(i<token.size() && digit(token[i]));
  }
  if(i<token.size() && token[i]=='.') {
    auto first=++i; while(i<token.size() && digit(token[i]))++i;
    if(i==first)return false;
  }
  if(i<token.size() && (token[i]=='e' || token[i]=='E')) {
    ++i; if(i<token.size() && (token[i]=='+' || token[i]=='-'))++i;
    auto first=i; while(i<token.size() && digit(token[i]))++i;
    if(i==first)return false;
  }
  return i==token.size();
}
} // namespace scene_json_depth
// Constant-stack lexical/depth guard; the platform parser still owns structural grammar.
inline bool sceneJSONDepthAllowed(std::string_view json) {
  unsigned depth = 0;
  bool quoted = false, escaped = false;
  for (std::size_t i=0;i<json.size();++i) {
    char c=json[i];
    if (quoted) {
      if (escaped) escaped = false;
      else if (c == '\\') escaped = true;
      else if (c == '"') quoted = false;
    } else if (c == '"') quoted = true;
    else if (c == '{' || c == '[') {
      if (++depth > 64) return false;
    } else if (c == '}' || c == ']') {
      if(depth==0)return false;
      --depth;
    } else if(!scene_json_depth::separator(c)) {
      auto end=i+1;
      while(end<json.size() && !scene_json_depth::separator(json[end]))++end;
      if(!scene_json_depth::literal(json.substr(i,end-i)))return false;
      i=end-1;
    }
  }
  return !quoted && depth==0;
}
} // namespace enhancedmaps
