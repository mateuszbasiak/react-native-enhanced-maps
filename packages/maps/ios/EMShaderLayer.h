// Native shared viewport transport for worklet-driven ShaderLayer.
#if MLN_RENDER_BACKEND_METAL
#import <IOSurface/IOSurfaceRef.h>
#import <CoreVideo/CoreVideo.h>
#import <React/RCTBridgeModule.h>
#import <React/RCTBridge+Private.h>
#include "../cpp/ShaderJSI.h"
@interface RCTBridge (EMShaderRuntime)
- (void *)runtime;
@end
@interface EMWebGPUOutputPool : NSObject {
@public
  std::shared_ptr<enhancedmaps::ShaderOutputState> state;
  IOSurfaceRef surfaces[3];
  int width,height;
  id<MTLTexture> textures[3];
}
@end
@implementation EMWebGPUOutputPool
- (instancetype)init { if((self=[super init]))state=std::make_shared<enhancedmaps::ShaderOutputState>();return self; }
- (void)dealloc { for(int i=0;i<3;i++)if(surfaces[i])CFRelease(surfaces[i]); }
@end
static NSMutableDictionary<NSString *,EMWebGPUOutputPool *> *EMWebGPUPools() {
  static NSMutableDictionary *pools;static dispatch_once_t once;
  dispatch_once(&once,^{ pools=[NSMutableDictionary new]; });return pools;
}
static EMWebGPUOutputPool *EMWebGPUPool(NSString *key) {
  @synchronized(EMWebGPUPools()) { return EMWebGPUPools()[key]; }
}
@interface EMShaderLayerModule : NSObject<RCTBridgeModule>
@property(nonatomic,weak) RCTBridge *bridge;
@end
@implementation EMShaderLayerModule
RCT_EXPORT_MODULE(EMShaderLayer)
@synthesize bridge=_bridge;
+ (BOOL)requiresMainQueueSetup { return NO; }
RCT_EXPORT_BLOCKING_SYNCHRONOUS_METHOD(install) {
  auto *runtime=(facebook::jsi::Runtime *)self.bridge.runtime;if(!runtime)return @NO;
  enhancedmaps::installShaderJSI(*runtime,[](std::string key) {
    EMWebGPUOutputPool *pool=EMWebGPUPool([NSString stringWithUTF8String:key.c_str()]);
    if(!pool)throw std::invalid_argument("Unknown shader pool");return pool->state;
  });return @YES;
}
- (void)invalidate {
  @synchronized(EMWebGPUPools()) { for(EMWebGPUOutputPool *pool in EMWebGPUPools().allValues)pool->state->close();[EMWebGPUPools() removeAllObjects]; }
}
#if DEBUG
RCT_EXPORT_BLOCKING_SYNCHRONOUS_METHOD(diagnostics) {
  unsigned produced=0,sampled=0;NSUInteger pools=0;
  @synchronized(EMWebGPUPools()) { pools=EMWebGPUPools().count;for(EMWebGPUOutputPool *pool in EMWebGPUPools().allValues){std::lock_guard<std::mutex> lock(pool->state->mutex);produced+=pool->state->produced;sampled+=pool->state->sampled;} }
  return @{@"produced":@(produced),@"sampled":@(sampled),@"pools":@(pools)};
}
#endif
RCT_EXPORT_METHOD(create:(double)width height:(double)height resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) {
  if(!std::isfinite(width)||!std::isfinite(height)||width!=std::floor(width)||height!=std::floor(height)||width<1||height<1||width>4096||height>4096) { reject(@"size",@"Shader output dimensions must be 1 to 4096 pixels",nil);return; }
  EMWebGPUOutputPool *pool=[EMWebGPUOutputPool new];pool->width=(int)width;pool->height=(int)height;
  NSMutableArray *handles=[NSMutableArray new];
  for(int i=0;i<3;i++) {
    NSDictionary *properties=@{(id)kIOSurfaceWidth:@(width),(id)kIOSurfaceHeight:@(height),(id)kIOSurfaceBytesPerElement:@4,
      (id)kIOSurfaceBytesPerRow:@(IOSurfaceAlignProperty(kIOSurfaceBytesPerRow,(size_t)width*4)),(id)kIOSurfacePixelFormat:@(kCVPixelFormatType_32BGRA)};
    pool->surfaces[i]=IOSurfaceCreate((__bridge CFDictionaryRef)properties);
    if(!pool->surfaces[i]) { reject(@"allocation",@"IOSurface allocation failed",nil);return; }
    [handles addObject:[NSString stringWithFormat:@"%llu",(unsigned long long)(uintptr_t)pool->surfaces[i]]];
  }
  NSString *key=NSUUID.UUID.UUIDString;
  @synchronized(EMWebGPUPools()) {
    if(EMWebGPUPools().count>=4) { reject(@"budget",@"At most four shader layers",nil);return; }
    EMWebGPUPools()[key]=pool;
  }
  resolve(@{@"id":key,@"handles":handles,@"format":@"bgra8unorm",@"size":@(width),@"width":@(width),@"height":@(height)});
}
#if DEBUG
RCT_EXPORT_METHOD(stats:(NSString *)key resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) {
  EMWebGPUOutputPool *pool=EMWebGPUPool(key);if(!pool){reject(@"closed",@"Unknown output pool",nil);return;}
  std::lock_guard<std::mutex> lock(pool->state->mutex);
  resolve(@{@"produced":@(pool->state->produced),@"sampled":@(pool->state->sampled),@"bytes":@(3*pool->width*pool->height*4)});
}
#endif
RCT_EXPORT_METHOD(release:(NSString *)key resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) {
  EMWebGPUOutputPool *pool;
  @synchronized(EMWebGPUPools()) { pool=EMWebGPUPools()[key];[EMWebGPUPools() removeObjectForKey:key]; }
  if(pool)pool->state->close();resolve(@YES);
}
@end

@interface EMWebGPUTextureLayer : MLNCustomStyleLayer
@property(nonatomic,strong) EMWebGPUOutputPool *pool;

@end
@implementation EMWebGPUTextureLayer {
  id<MTLRenderPipelineState> _pipeline;
  id<MTLDepthStencilState> _depth;
}
- (void)drawInMapView:(MLNMapView *)map withContext:(MLNStyleLayerDrawingContext)context {
  EMWebGPUOutputPool *pool=self.pool;
  if(!pool || !self.renderEncoder)return;
  MLNBackendResource *resource=[map backendResource];
  pool->state->updateView(&context.projectionMatrix.m00,context.zoomLevel,(int)resource.mtkView.drawableSize.width,(int)resource.mtkView.drawableSize.height);
  if(!pool->state->isZoomVisible(context.zoomLevel))return;
  if(!_pipeline) {
    NSString *source=@(R"METAL(
#include <metal_stdlib>
using namespace metal;
struct V { float4 clip; float2 uv; };
struct O { float4 position [[position]]; float2 uv; };
vertex O sharedVertex(uint i [[vertex_id]], constant V *v [[buffer(0)]]) {
  O o;o.position=v[i].clip;o.position.z=o.position.w;o.uv=v[i].uv;return o;
}
fragment float4 sharedFragment(O in [[stage_in]], texture2d<float> image [[texture(0)]]) {
  constexpr sampler linearSampler(coord::normalized,filter::linear,address::clamp_to_edge);
  return image.sample(linearSampler,in.uv);
}
)METAL");
    NSError *error=nil;id<MTLLibrary> library=[resource.device newLibraryWithSource:source options:nil error:&error];
    MTLRenderPipelineDescriptor *p=[MTLRenderPipelineDescriptor new];
    p.vertexFunction=[library newFunctionWithName:@"sharedVertex"];p.fragmentFunction=[library newFunctionWithName:@"sharedFragment"];
    p.colorAttachments[0].pixelFormat=resource.mtkView.colorPixelFormat;
    p.depthAttachmentPixelFormat=resource.mtkView.depthStencilPixelFormat;p.stencilAttachmentPixelFormat=resource.mtkView.depthStencilPixelFormat;p.rasterSampleCount=resource.mtkView.sampleCount;
    p.colorAttachments[0].blendingEnabled=YES;p.colorAttachments[0].sourceRGBBlendFactor=MTLBlendFactorOne;p.colorAttachments[0].destinationRGBBlendFactor=MTLBlendFactorOneMinusSourceAlpha;
    p.colorAttachments[0].sourceAlphaBlendFactor=MTLBlendFactorOne;p.colorAttachments[0].destinationAlphaBlendFactor=MTLBlendFactorOneMinusSourceAlpha;
    _pipeline=library?[resource.device newRenderPipelineStateWithDescriptor:p error:&error]:nil;
    if(!_pipeline) { NSLog(@"WebGPU prototype compositor: %@",error);return; }
    MTLDepthStencilDescriptor *d=[MTLDepthStencilDescriptor new];d.depthCompareFunction=MTLCompareFunctionAlways;d.depthWriteEnabled=NO;
    _depth=[resource.device newDepthStencilStateWithDescriptor:d];
  }
  int index;enhancedmaps::ShaderCamera source,current;

  { std::lock_guard<std::mutex> lock(pool->state->mutex);
    index=pool->state->slots.beginRead();if(index<0)return;
    if(!pool->textures[index]) {
      MTLTextureDescriptor *d=[MTLTextureDescriptor texture2DDescriptorWithPixelFormat:MTLPixelFormatBGRA8Unorm width:pool->width height:pool->height mipmapped:NO];
      d.usage=MTLTextureUsageShaderRead;d.storageMode=MTLStorageModeShared;
      pool->textures[index]=[resource.device newTextureWithDescriptor:d iosurface:pool->surfaces[index] plane:0];
    }
    if(!pool->textures[index]) { pool->state->slots.endRead(index);return; }
    pool->state->sampled++;source=pool->state->cameras[index];current=pool->state->camera;
  }
  id<MTLRenderCommandEncoder> encoder=self.renderEncoder;
  [encoder setRenderPipelineState:_pipeline];[encoder setDepthStencilState:_depth];[encoder setCullMode:MTLCullModeNone];
  [encoder setFragmentTexture:pool->textures[index] atIndex:0];
  if(source.valid) {
    float packed[24];if(enhancedmaps::shaderViewportQuad(source,current,packed)) {
      struct Vertex { vector_float4 clip;vector_float2 uv; } vertices[4];
      for(int i=0;i<4;i++){vertices[i].clip={packed[i*6],packed[i*6+1],0,packed[i*6+3]};vertices[i].uv={packed[i*6+4],packed[i*6+5]};}
      [encoder setVertexBytes:vertices length:sizeof(vertices) atIndex:0];
      [encoder drawPrimitives:MTLPrimitiveTypeTriangleStrip vertexStart:0 vertexCount:4];
    }
  }
  [self.commandBuffer addCompletedHandler:^(id<MTLCommandBuffer> buffer) { { std::lock_guard<std::mutex> lock(pool->state->mutex);pool->state->slots.endRead(index); } }];
}
@end
#endif
