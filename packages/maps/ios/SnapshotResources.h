#import <Foundation/Foundation.h>

/** Resolve relative style resources without URL-escaping MapLibre templates. */
static NSString *EMSnapshotResource(NSString *value,NSURL *base) {
  if(![value isKindOfClass:NSString.class] || !value.length)return value;
  // Already absolute strings must remain byte-for-byte SDK templates.
  if([NSURLComponents componentsWithString:value].scheme.length)return value;
  NSRegularExpression *pattern=[NSRegularExpression regularExpressionWithPattern:@"\\{[^{}]+\\}" options:0 error:nil];
  NSArray<NSTextCheckingResult *> *matches=[pattern matchesInString:value options:0 range:NSMakeRange(0,value.length)];
  NSMutableString *escaped=[value mutableCopy];
  NSMutableDictionary<NSString *,NSString *> *templates=[NSMutableDictionary new];
  NSString *prefix=[@"EMSNAPSHOTTEMPLATE" stringByAppendingString:[NSUUID.UUID.UUIDString stringByReplacingOccurrencesOfString:@"-" withString:@""]];
  for(NSTextCheckingResult *match in matches.reverseObjectEnumerator) {
    NSString *key=[prefix stringByAppendingFormat:@"%lu",(unsigned long)match.range.location];
    templates[key]=[value substringWithRange:match.range];
    [escaped replaceCharactersInRange:match.range withString:key];
  }
  NSMutableString *resolved=[([NSURL URLWithString:escaped relativeToURL:base].absoluteURL.absoluteString?:value) mutableCopy];
  for(NSString *key in templates)[resolved replaceOccurrencesOfString:key withString:templates[key] options:0 range:NSMakeRange(0,resolved.length)];
  return resolved;
}
