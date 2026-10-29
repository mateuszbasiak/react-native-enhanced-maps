package com.enhancedmaps;

/** Constant-stack lexical/depth guard before parsing. The framework owns structural grammar. */
public final class SceneJSONDepth {
  private SceneJSONDepth() {}
  private static boolean separator(char c) {
    return c==' ' || c=='\t' || c=='\r' || c=='\n' || c=='{' || c=='}' || c=='[' || c==']' || c==',' || c==':';
  }
  private static boolean digit(char c) { return c>='0' && c<='9'; }
  private static boolean literal(String json, int start, int end) {
    int n=end-start;
    if((n==4 && (json.regionMatches(start,"true",0,4) || json.regionMatches(start,"null",0,4))) || (n==5 && json.regionMatches(start,"false",0,5)))return true;
    int i=start;
    if(i<end && json.charAt(i)=='-')i++;
    if(i==end)return false;
    if(json.charAt(i)=='0')i++;
    else {
      if(json.charAt(i)<'1' || json.charAt(i)>'9')return false;
      do {i++;} while(i<end && digit(json.charAt(i)));
    }
    if(i<end && json.charAt(i)=='.') {
      int first=++i; while(i<end && digit(json.charAt(i)))i++;
      if(i==first)return false;
    }
    if(i<end && (json.charAt(i)=='e' || json.charAt(i)=='E')) {
      i++; if(i<end && (json.charAt(i)=='+' || json.charAt(i)=='-'))i++;
      int first=i; while(i<end && digit(json.charAt(i)))i++;
      if(i==first)return false;
    }
    return i==end;
  }
  public static boolean allowed(String json) {
    int depth = 0;
    boolean quoted = false, escaped = false;
    for (int i = 0; i < json.length(); i++) {
      char c = json.charAt(i);
      if (quoted) {
        if (escaped) escaped = false;
        else if (c == '\\') escaped = true;
        else if (c == '"') quoted = false;
      } else if (c == '"') quoted = true;
      else if (c == '{' || c == '[') {
        if (++depth > 64) return false;
      } else if (c == '}' || c == ']') {
        if(depth==0)return false;
        depth--;
      } else if(!separator(c)) {
        int end=i+1;
        while(end<json.length() && !separator(json.charAt(end)))end++;
        if(!literal(json,i,end))return false;
        i=end-1;
      }
    }
    return !quoted && depth==0;
  }
}
