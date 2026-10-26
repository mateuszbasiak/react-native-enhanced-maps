// ShaderLayer shared output. Pinned MapLibre headers carry their upstream license alongside.
#include <jni.h>
#include <android/hardware_buffer.h>
#include <EGL/egl.h>
#include <EGL/eglext.h>
#include <GLES3/gl3.h>
#include <GLES2/gl2ext.h>
#include <mln/style/layers/custom_layer_host.hpp>
#include "ShaderJSI.h"
#include <mutex>
#include <memory>
#include <map>
#include <vector>
#include <string>
#include <cmath>
#include <stdexcept>
#include <dlfcn.h>

namespace {
using AllocateBuffer=int (*)(const AHardwareBuffer_Desc*,AHardwareBuffer**);
using ReleaseBuffer=void (*)(AHardwareBuffer*);
auto allocateBuffer=reinterpret_cast<AllocateBuffer>(dlsym(RTLD_DEFAULT,"AHardwareBuffer_allocate"));
auto releaseBuffer=reinterpret_cast<ReleaseBuffer>(dlsym(RTLD_DEFAULT,"AHardwareBuffer_release"));
struct Pool {
  std::shared_ptr<enhancedmaps::ShaderOutputState> state=std::make_shared<enhancedmaps::ShaderOutputState>();
  AHardwareBuffer* buffers[3]{};
  int width=0,height=0;

  ~Pool() { for(auto* b:buffers)if(b)releaseBuffer(b); }
};
std::mutex registryMutex;
std::map<std::string,std::shared_ptr<Pool>> registry;
unsigned nextID=0;
std::string string(JNIEnv* env,jstring s) {
  if(!s)throw std::invalid_argument("Missing pool ID");
  const char* chars=env->GetStringUTFChars(s,nullptr);std::string value(chars);env->ReleaseStringUTFChars(s,chars);return value;
}
std::shared_ptr<Pool> find(const std::string& id) {
  std::lock_guard<std::mutex> lock(registryMutex);auto it=registry.find(id);
  if(it==registry.end())throw std::invalid_argument("Unknown output pool");return it->second;
}
void fail(JNIEnv* env,const std::exception& e) { env->ThrowNew(env->FindClass("java/lang/IllegalStateException"),e.what()); }
std::string escape(std::string s) { std::string out;for(char c:s) { if(c=='"' || c=='\\')out+='\\';if(c>=' ')out+=c; }return out; }
GLuint shader(GLenum type,const char* source) {
  GLuint object=glCreateShader(type);glShaderSource(object,1,&source,nullptr);glCompileShader(object);
  GLint okay;glGetShaderiv(object,GL_COMPILE_STATUS,&okay);
  if(!okay) { char log[1024];glGetShaderInfoLog(object,sizeof(log),nullptr,log);glDeleteShader(object);throw std::runtime_error(log); }return object;
}
class OutputHost final:public mln::style::CustomLayerHost {
  std::shared_ptr<Pool> pool;

  GLuint program=0,vao=0,vbo=0,images[3]{};
  EGLDisplay allocationDisplay=EGL_NO_DISPLAY;
  EGLImageKHR eglImages[3]{EGL_NO_IMAGE_KHR,EGL_NO_IMAGE_KHR,EGL_NO_IMAGE_KHR};
  struct Read { int index;GLsync done; };std::vector<Read> reads;
  void poll() {
    for(auto it=reads.begin();it!=reads.end();) {
      GLenum result=glClientWaitSync(it->done,0,0);
      if(result==GL_ALREADY_SIGNALED || result==GL_CONDITION_SATISFIED) {
        { std::lock_guard<std::mutex> lock(pool->state->mutex);pool->state->slots.endRead(it->index); }
        glDeleteSync(it->done);it=reads.erase(it);
      } else ++it;
    }
  }
public:
  explicit OutputHost(std::shared_ptr<Pool> p):pool(std::move(p)) {}
  void initialize(const mln::style::CustomLayerInitParameters&) override {
    try {
      GLuint vs=shader(GL_VERTEX_SHADER,"#version 300 es\nlayout(location=0) in vec4 clip;layout(location=1) in vec2 uv;out vec2 texCoord;void main(){gl_Position=vec4(clip.xy,clip.w,clip.w);texCoord=uv;}");
      GLuint fs=shader(GL_FRAGMENT_SHADER,"#version 300 es\nprecision highp float;uniform sampler2D image;in vec2 texCoord;out vec4 color;void main(){color=texture(image,texCoord);}");
      program=glCreateProgram();glAttachShader(program,vs);glAttachShader(program,fs);glLinkProgram(program);glDeleteShader(vs);glDeleteShader(fs);
      GLint okay;glGetProgramiv(program,GL_LINK_STATUS,&okay);if(!okay)throw std::runtime_error("GLES compositor link failed");
      glGenVertexArrays(1,&vao);glGenBuffers(1,&vbo);
    } catch(const std::exception& e) { std::lock_guard<std::mutex> lock(pool->state->mutex);pool->state->error=e.what(); }
  }
  void render(const mln::style::CustomLayerRenderParameters& p) override {
    GLint viewport[4];glGetIntegerv(GL_VIEWPORT,viewport);
    pool->state->updateView(p.projectionMatrix.data(),p.zoom,viewport[2],viewport[3]);
    poll();
    // A busy consumer needs another GL-context poll even when the producer cannot acquire.
    // Once outstanding reads drain, only publication or camera changes request frames.
    if(!reads.empty()){std::function<void()> repaint;{std::lock_guard<std::mutex> lock(pool->state->mutex);repaint=pool->state->repaint;}if(repaint)repaint();}
    if(!program || reads.size()>=8 || !pool->state->isZoomVisible(p.zoom))return;
    int index;enhancedmaps::ShaderCamera source,current;
    bool drawSubmitted=false;
    { std::lock_guard<std::mutex> lock(pool->state->mutex);index=pool->state->slots.beginRead();if(index>=0){source=pool->state->cameras[index];current=pool->state->camera;} }
    if(index<0)return;
    try {
      glActiveTexture(GL_TEXTURE0);
      if(!images[index]) {
        auto client=reinterpret_cast<PFNEGLGETNATIVECLIENTBUFFERANDROIDPROC>(eglGetProcAddress("eglGetNativeClientBufferANDROID"));
        auto create=reinterpret_cast<PFNEGLCREATEIMAGEKHRPROC>(eglGetProcAddress("eglCreateImageKHR"));
        auto bind=reinterpret_cast<PFNGLEGLIMAGETARGETTEXTURE2DOESPROC>(eglGetProcAddress("glEGLImageTargetTexture2DOES"));
        if(!client || !create || !bind)throw std::runtime_error("Missing AHardwareBuffer EGL/GLES import extensions");
        EGLint attributes[]={EGL_IMAGE_PRESERVED_KHR,EGL_TRUE,EGL_NONE};
        allocationDisplay=eglGetCurrentDisplay();
        eglImages[index]=create(allocationDisplay,EGL_NO_CONTEXT,EGL_NATIVE_BUFFER_ANDROID,client(pool->buffers[index]),attributes);
        if(eglImages[index]==EGL_NO_IMAGE_KHR)throw std::runtime_error("AHardwareBuffer EGLImage import failed");
        glGenTextures(1,&images[index]);glBindTexture(GL_TEXTURE_2D,images[index]);bind(GL_TEXTURE_2D,eglImages[index]);
        glTexParameteri(GL_TEXTURE_2D,GL_TEXTURE_MIN_FILTER,GL_LINEAR);glTexParameteri(GL_TEXTURE_2D,GL_TEXTURE_MAG_FILTER,GL_LINEAR);
        glTexParameteri(GL_TEXTURE_2D,GL_TEXTURE_WRAP_S,GL_CLAMP_TO_EDGE);glTexParameteri(GL_TEXTURE_2D,GL_TEXTURE_WRAP_T,GL_CLAMP_TO_EDGE);
        if(glGetError()!=GL_NO_ERROR)throw std::runtime_error("AHardwareBuffer GLES texture binding failed");
      }
      glBindTexture(GL_TEXTURE_2D,images[index]);
      glUseProgram(program);glUniform1i(glGetUniformLocation(program,"image"),0);
      glBindVertexArray(vao);glBindBuffer(GL_ARRAY_BUFFER,vbo);
      glEnableVertexAttribArray(0);glVertexAttribPointer(0,4,GL_FLOAT,GL_FALSE,6*sizeof(float),nullptr);
      glEnableVertexAttribArray(1);glVertexAttribPointer(1,2,GL_FLOAT,GL_FALSE,6*sizeof(float),(void*)(4*sizeof(float)));
      glDisable(GL_DEPTH_TEST);glDepthMask(GL_FALSE);glDisable(GL_STENCIL_TEST);glDisable(GL_CULL_FACE);
      glEnable(GL_BLEND);glBlendEquation(GL_FUNC_ADD);glBlendFunc(GL_ONE,GL_ONE_MINUS_SRC_ALPHA);
      if(source.valid) {
        float vertices[24];if(enhancedmaps::shaderViewportQuad(source,current,vertices)) {
          glBufferData(GL_ARRAY_BUFFER,sizeof(vertices),vertices,GL_STREAM_DRAW);
          glDrawArrays(GL_TRIANGLE_STRIP,0,4);drawSubmitted=true;
        }
      }
      GLsync done=glFenceSync(GL_SYNC_GPU_COMMANDS_COMPLETE,0);glFlush();
      if(!done)throw std::runtime_error("GLES consumer fence failed");
      reads.push_back({index,done});
      { std::lock_guard<std::mutex> lock(pool->state->mutex);pool->state->sampled++; }
    } catch(const std::exception& e) {
      // A missing fence cannot turn an already submitted GPU read into a free slot.
      // Completion on this exceptional path is synchronous; the normal path never waits.
      if(drawSubmitted)glFinish();
      std::lock_guard<std::mutex> lock(pool->state->mutex);pool->state->error=e.what();pool->state->slots.endRead(index);
    }
  }
  void destroyEGLImages() {
    auto destroy=reinterpret_cast<PFNEGLDESTROYIMAGEKHRPROC>(eglGetProcAddress("eglDestroyImageKHR"));
    for(int i=0;i<3;i++) {
      if(destroy && allocationDisplay!=EGL_NO_DISPLAY && eglImages[i]!=EGL_NO_IMAGE_KHR)destroy(allocationDisplay,eglImages[i]);
      eglImages[i]=EGL_NO_IMAGE_KHR;
    }
    allocationDisplay=EGL_NO_DISPLAY;
  }
  void contextLost() override {
    for(auto read:reads) { std::lock_guard<std::mutex> lock(pool->state->mutex);pool->state->slots.endRead(read.index); }
    destroyEGLImages();
    reads.clear();program=vao=vbo=0;for(int i=0;i<3;i++)images[i]=0;
  }
  void deinitialize() override {
    if(!reads.empty()) { glFinish();for(auto read:reads) { glDeleteSync(read.done);std::lock_guard<std::mutex> lock(pool->state->mutex);pool->state->slots.endRead(read.index); }reads.clear(); }
    if(program)glDeleteProgram(program);if(vao)glDeleteVertexArrays(1,&vao);if(vbo)glDeleteBuffers(1,&vbo);
    for(int i=0;i<3;i++)if(images[i])glDeleteTextures(1,&images[i]);
    destroyEGLImages();
    program=vao=vbo=0;for(int i=0;i<3;i++) { images[i]=0;eglImages[i]=EGL_NO_IMAGE_KHR; }
  }
};
}
extern "C" JNIEXPORT jstring JNICALL Java_com_enhancedmaps_SharedOutputNative_create(JNIEnv* env,jclass,jint width,jint height) {
 try {
  if(!allocateBuffer || !releaseBuffer)throw std::runtime_error("AHardwareBuffer requires Android 26+");
  if(width<1||height<1||width>4096||height>4096)throw std::invalid_argument("Shader output dimensions must be 1 to 4096 pixels");
  auto pool=std::make_shared<Pool>();pool->width=width;pool->height=height;
  for(int i=0;i<3;i++) {
    AHardwareBuffer_Desc d{};d.width=width;d.height=height;d.layers=1;d.format=AHARDWAREBUFFER_FORMAT_R8G8B8A8_UNORM;
    d.usage=AHARDWAREBUFFER_USAGE_GPU_SAMPLED_IMAGE|AHARDWAREBUFFER_USAGE_GPU_COLOR_OUTPUT;
    if(allocateBuffer(&d,&pool->buffers[i])!=0)throw std::runtime_error("Writable AHardwareBuffer allocation failed");
  }
  std::lock_guard<std::mutex> lock(registryMutex);if(registry.size()>=4)throw std::runtime_error("At most four prototype pools");
  std::string id=std::to_string(++nextID);registry[id]=pool;
  std::string result="{\"id\":\""+id+"\",\"format\":\"rgba8unorm\",\"size\":"+std::to_string(width)+",\"width\":"+std::to_string(width)+",\"height\":"+std::to_string(height)+",\"handles\":[";
  for(int i=0;i<3;i++) { if(i)result+=",";result+="\""+std::to_string((uintptr_t)pool->buffers[i])+"\""; }
  result+="]}";return env->NewStringUTF(result.c_str());
 } catch(const std::exception& e) { fail(env,e);return nullptr; }
}
extern "C" JNIEXPORT void JNICALL Java_com_enhancedmaps_SharedOutputNative_release(JNIEnv* env,jclass,jstring key) {
 try { std::string id=string(env,key);std::lock_guard<std::mutex> registryLock(registryMutex);auto it=registry.find(id);if(it!=registry.end()) { auto pool=it->second;std::lock_guard<std::mutex> lock(pool->state->mutex);pool->state->closed=true;pool->state->slots.close();pool->state->repaint=nullptr;registry.erase(it); } }catch(const std::exception& e) { fail(env,e); }
}
extern "C" JNIEXPORT jstring JNICALL Java_com_enhancedmaps_SharedOutputNative_stats(JNIEnv* env,jclass,jstring key) {
 try { auto pool=find(string(env,key));std::lock_guard<std::mutex> lock(pool->state->mutex);
  std::string result="{\"produced\":"+std::to_string(pool->state->produced)+",\"sampled\":"+std::to_string(pool->state->sampled)+",\"slots\":3,\"bytes\":"+std::to_string(3*pool->width*pool->height*4)+",\"error\":\""+escape(pool->state->error)+"\"}";return env->NewStringUTF(result.c_str());
 }catch(const std::exception& e) { fail(env,e);return nullptr; }
}
namespace {
struct RepaintCallback {
 JavaVM* vm;jobject callback;
 RepaintCallback(JNIEnv* env,jobject fn) {env->GetJavaVM(&vm);callback=env->NewGlobalRef(fn);}
 ~RepaintCallback() {JNIEnv* env;bool attach=vm->GetEnv((void**)&env,JNI_VERSION_1_6)!=JNI_OK;if(attach)vm->AttachCurrentThread(&env,nullptr);env->DeleteGlobalRef(callback);if(attach)vm->DetachCurrentThread();}
 void run() {JNIEnv* env;bool attach=vm->GetEnv((void**)&env,JNI_VERSION_1_6)!=JNI_OK;if(attach)vm->AttachCurrentThread(&env,nullptr);auto type=env->GetObjectClass(callback);auto method=env->GetMethodID(type,"run","()V");env->CallVoidMethod(callback,method);env->DeleteLocalRef(type);if(env->ExceptionCheck())env->ExceptionClear();if(attach)vm->DetachCurrentThread();}
};
}
extern "C" JNIEXPORT jlong JNICALL Java_com_enhancedmaps_SharedOutputNative_host(JNIEnv* env,jclass,jstring key,jobject repaint) {
 try {auto pool=find(string(env,key));auto fn=std::make_shared<RepaintCallback>(env,repaint);{std::lock_guard<std::mutex> lock(pool->state->mutex);pool->state->repaint=[fn]{fn->run();};}return reinterpret_cast<jlong>(new OutputHost(pool)); }catch(const std::exception& e) { fail(env,e);return 0; }
}
extern "C" JNIEXPORT void JNICALL Java_com_enhancedmaps_SharedOutputNative_install(JNIEnv* env,jclass,jlong runtime) {
 try {if(!runtime)throw std::runtime_error("JSI runtime unavailable");enhancedmaps::installShaderJSI(*reinterpret_cast<facebook::jsi::Runtime*>(runtime),[](std::string key){return find(key)->state;});}catch(const std::exception& e){fail(env,e);}
}

extern "C" JNIEXPORT void JNICALL Java_com_enhancedmaps_SharedOutputNative_clear(JNIEnv*,jclass) {
 std::lock_guard<std::mutex> lock(registryMutex);for(auto& entry:registry)entry.second->state->close();registry.clear();
}

extern "C" JNIEXPORT jstring JNICALL Java_com_enhancedmaps_SharedOutputNative_totals(JNIEnv* env,jclass) {
 unsigned produced=0,sampled=0;std::lock_guard<std::mutex> lock(registryMutex);
 for(auto& entry:registry){std::lock_guard<std::mutex> stateLock(entry.second->state->mutex);produced+=entry.second->state->produced;sampled+=entry.second->state->sampled;}
 auto json="{\"produced\":"+std::to_string(produced)+",\"sampled\":"+std::to_string(sampled)+",\"pools\":"+std::to_string(registry.size())+"}";
 return env->NewStringUTF(json.c_str());
}
