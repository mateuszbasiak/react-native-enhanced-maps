// Throwaway feasibility spike. Included only by EMMapLibreView.mm in Debug.
// Not a public shader API and not a TypeGPU integration.
#if DEBUG && MLN_RENDER_BACKEND_METAL
#import <simd/simd.h>

@class EMShaderPrototype;
@interface EMShaderPrototypeTick : NSObject
@property(nonatomic,weak) EMShaderPrototype *layer;
- (void)tick:(CADisplayLink *)link;
@end
@interface EMShaderPrototype : MLNCustomStyleLayer
@property(nonatomic) BOOL paused;
@property(nonatomic,readonly) NSUInteger frames;
@property(nonatomic,readonly) double maxAnchorError;
@property(nonatomic,readonly) NSString *failure;
- (void)stop;
- (void)configure:(NSDictionary *)settings;
- (void)setEffectSource:(NSString *)source;
@end
@implementation EMShaderPrototype {
  id<MTLRenderPipelineState> _pipeline;
  id<MTLDepthStencilState> _depth;
  CADisplayLink *_link;
  __weak MLNMapView *_owner;
  double _time;
  CFTimeInterval _lastTick;
  NSUInteger _frames;
  double _maxAnchorError;
  NSString *_failure;
  vector_float4 _tint;
  float _speed;
  vector_float4 _parameters;
  NSString *_effectSource;
  BOOL _needsCompile;
}
- (instancetype)initWithIdentifier:(NSString *)identifier {
  if((self=[super initWithIdentifier:identifier])) { _tint={0.04f,0.48f,0.95f,1.f};_speed=1;_parameters={100,0,0,0}; }
  return self;
}
- (void)configure:(NSDictionary *)settings {
  if(![settings isKindOfClass:NSDictionary.class])
    @throw [NSException exceptionWithName:@"ShaderPrototype" reason:@"Missing shader uniforms" userInfo:nil];
  auto scalar=[&](NSString *key,double min,double max)->float {
    id value=settings[key];
    if(![value isKindOfClass:NSNumber.class] || CFGetTypeID((__bridge CFTypeRef)value)==CFBooleanGetTypeID() || !std::isfinite([value doubleValue]) || [value doubleValue]<min || [value doubleValue]>max)
      @throw [NSException exceptionWithName:@"ShaderPrototype" reason:[@"Invalid shader uniform: " stringByAppendingString:key] userInfo:nil];
    return [value floatValue];
  };
  vector_float4 tint={scalar(@"red",0,1),scalar(@"green",0,1),scalar(@"blue",0,1),scalar(@"opacity",0,1)};
  float speed=scalar(@"speed",0,5);
  id parameters=settings[@"parameters"];
  if(![parameters isKindOfClass:NSArray.class] || [parameters count]!=4)
    @throw [NSException exceptionWithName:@"ShaderPrototype" reason:@"Expected four shader parameters" userInfo:nil];
  vector_float4 values;
  for(int i=0;i<4;i++) {
    id value=parameters[i];
    if(![value isKindOfClass:NSNumber.class] || CFGetTypeID((__bridge CFTypeRef)value)==CFBooleanGetTypeID() || !std::isfinite([value doubleValue]) || std::abs([value doubleValue])>10000)
      @throw [NSException exceptionWithName:@"ShaderPrototype" reason:@"Invalid shader parameter" userInfo:nil];
    values[i]=[value floatValue];
  }
  _tint=tint;_speed=speed;_parameters=values;
  [self setNeedsDisplay];
}
- (void)setEffectSource:(NSString *)source {
  if(![source isKindOfClass:NSString.class] || source.length==0 || [source lengthOfBytesUsingEncoding:NSUTF8StringEncoding]>16384)
    @throw [NSException exceptionWithName:@"ShaderPrototype" reason:@"Shader source must be 1-16384 UTF-8 bytes" userInfo:nil];
  if([_effectSource isEqualToString:source])return;
  _effectSource=[source copy];_needsCompile=YES;_failure=nil;
  [self setNeedsDisplay];
}
- (void)didMoveToMapView:(MLNMapView *)map {
  _owner=map;
  EMShaderPrototypeTick *target=[EMShaderPrototypeTick new];target.layer=self;
  _link=[CADisplayLink displayLinkWithTarget:target selector:@selector(tick:)];
  _link.preferredFramesPerSecond=30;
  [_link addToRunLoop:NSRunLoop.mainRunLoop forMode:NSRunLoopCommonModes];
}
- (void)advance:(CADisplayLink *)link {
  if(!_paused && _owner.window && UIApplication.sharedApplication.applicationState==UIApplicationStateActive) {
    if(_lastTick)_time+=MIN(link.timestamp-_lastTick,0.1)*_speed;
    [self setNeedsDisplay];
  }
  _lastTick=link.timestamp;
}
- (void)stop { [_link invalidate];_link=nil;_pipeline=nil;_depth=nil;_owner=nil; }
- (void)willMoveFromMapView:(MLNMapView *)map { [self stop]; }
- (void)dealloc { [_link invalidate]; }
- (NSUInteger)frames { return _frames; }
- (double)maxAnchorError { return _maxAnchorError; }
- (NSString *)failure { return _failure ?: @""; }
- (void)drawInMapView:(MLNMapView *)map withContext:(MLNStyleLayerDrawingContext)context {
  id<MTLRenderCommandEncoder> encoder=self.renderEncoder;
  if(!encoder)return;
  if(_needsCompile) {
    _needsCompile=NO;
    MLNBackendResource *resource=[map backendResource];
    // The fragment shader owns animation. Only time and four projected corners
    // change per frame; no CPU pixels or particle coordinates cross JS.
    NSString *source=@(R"METAL(
#include <metal_stdlib>
using namespace metal;
struct V { float4 clip; float2 uv; };
struct O { float4 position [[position]]; float2 uv; };
vertex O flowVertex(uint i [[vertex_id]], constant V *v [[buffer(0)]]) {
  O o; o.position=v[i].clip; o.position.z=o.position.w; o.uv=v[i].uv; return o;
}
)METAL");
    NSString *wrapper=@(R"METAL(
struct U { float4 tint; float4 motion; float4 parameters; };
fragment float4 flowFragment(O in [[stage_in]], constant U &u [[buffer(0)]]) {
  return mapEffect(in.uv, u.motion.x, u.tint, u.parameters);
}
)METAL");
    source=[[source stringByAppendingString:_effectSource ?: @""] stringByAppendingString:wrapper];
    NSError *error=nil;
    id<MTLLibrary> library=[resource.device newLibraryWithSource:source options:nil error:&error];
    if(!library) { _failure=error.localizedDescription ?: @"Metal shader compilation failed"; }
    else {
    MTLRenderPipelineDescriptor *p=[MTLRenderPipelineDescriptor new];
    p.vertexFunction=[library newFunctionWithName:@"flowVertex"];
    p.fragmentFunction=[library newFunctionWithName:@"flowFragment"];
    p.colorAttachments[0].pixelFormat=resource.mtkView.colorPixelFormat;
    p.depthAttachmentPixelFormat=resource.mtkView.depthStencilPixelFormat;
    p.stencilAttachmentPixelFormat=resource.mtkView.depthStencilPixelFormat;
    p.rasterSampleCount=resource.mtkView.sampleCount;
    p.colorAttachments[0].blendingEnabled=YES;
    p.colorAttachments[0].sourceRGBBlendFactor=MTLBlendFactorOne;
    p.colorAttachments[0].destinationRGBBlendFactor=MTLBlendFactorOneMinusSourceAlpha;
    p.colorAttachments[0].sourceAlphaBlendFactor=MTLBlendFactorOne;
    p.colorAttachments[0].destinationAlphaBlendFactor=MTLBlendFactorOneMinusSourceAlpha;
    id<MTLRenderPipelineState> candidate=[resource.device newRenderPipelineStateWithDescriptor:p error:&error];
    if(!candidate) { _failure=error.localizedDescription ?: @"Metal pipeline failed"; }
    else { _pipeline=candidate;_failure=nil; }
    MTLDepthStencilDescriptor *d=[MTLDepthStencilDescriptor new];
    d.depthCompareFunction=MTLCompareFunctionAlways;d.depthWriteEnabled=NO;
    _depth=[resource.device newDepthStencilStateWithDescriptor:d];
    }
  }
  if(!_pipeline)return;
  // Bounded local Mercator quad over central Gdansk. Preserve homogeneous w for
  // perspective interpolation. Double CPU math avoids large-world float loss.
  CLLocationCoordinate2D corners[]={
    {54.345,18.60},{54.345,18.73},{54.405,18.60},{54.405,18.73}
  };
  struct Vertex { vector_float4 clip; vector_float2 uv; } vertices[4];
  const double *m=&context.projectionMatrix.m00;
  for(int i=0;i<4;i++) {
    MLNMapPoint point=MLNMapPointForCoordinate(corners[i],context.zoomLevel);
    double clip[4];for(int row=0;row<4;row++)clip[row]=m[row]*point.x+m[4+row]*point.y+m[12+row];
    vertices[i].clip={(float)clip[0],(float)clip[1],(float)clip[2],(float)clip[3]};
    vertices[i].uv={(float)(i%2),(float)(i/2)};
    CGPoint actual=[map convertCoordinate:corners[i] toPointToView:map];
    double x=(clip[0]/clip[3]+1)*map.bounds.size.width/2;
    double y=(1-clip[1]/clip[3])*map.bounds.size.height/2;
    if(std::isfinite(x) && std::isfinite(y) && clip[3]>0)
      _maxAnchorError=MAX(_maxAnchorError,std::hypot(x-actual.x,y-actual.y));
  }
  struct Uniforms { vector_float4 tint; vector_float4 motion; vector_float4 parameters; } uniforms={_tint,{(float)_time,0,0,0},_parameters};
  [encoder setRenderPipelineState:_pipeline];[encoder setDepthStencilState:_depth];
  [encoder setCullMode:MTLCullModeNone];
  [encoder setVertexBytes:vertices length:sizeof(vertices) atIndex:0];
  [encoder setFragmentBytes:&uniforms length:sizeof(uniforms) atIndex:0];
  [encoder drawPrimitives:MTLPrimitiveTypeTriangleStrip vertexStart:0 vertexCount:4];
  _frames++;
}
@end
@implementation EMShaderPrototypeTick
- (void)tick:(CADisplayLink *)link { [self.layer advance:link]; }
@end
#endif
