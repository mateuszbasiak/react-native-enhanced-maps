package com.enhancedmaps

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import com.facebook.react.modules.network.OkHttpClientProvider
import okhttp3.Call
import okhttp3.Request
import java.io.File
import java.io.InputStream
import java.net.URI
import java.util.concurrent.Future
import java.util.concurrent.LinkedBlockingQueue
import java.util.concurrent.ThreadPoolExecutor
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean

/** One serial worker per map; candidates never modify its accepted image cache. */
internal class StagedOverlayImages(private val context:Context) {
  private val worker=ThreadPoolExecutor(1,1,0,TimeUnit.MILLISECONDS,LinkedBlockingQueue<Runnable>())
  private var job:Job?=null
  private var future:Future<*>?=null
  private class Job {
    val cancelled=AtomicBoolean(false)
    @Volatile var call:Call?=null
    @Volatile var stream:InputStream?=null
    fun check(){if(cancelled.get() || Thread.currentThread().isInterrupted)throw InterruptedException()}
    fun cancel(){cancelled.set(true);call?.cancel();try{stream?.close()}catch(_:Exception){}}
  }
  fun cancel(){job?.cancel();future?.cancel(true);job=null;future=null;worker.purge()}
  fun close(){cancel();worker.shutdownNow()}
  fun load(uris:List<String>,accepted:Map<String,Bitmap>,dimension:Int,completion:(Map<String,Bitmap>?,String?)->Unit) {
    cancel()
    val current=Job();job=current
    future=worker.submit {
      try {
        val images=uris.distinct().associateWith { uri ->
          current.check()
          accepted[uri] ?: decode(uri,dimension,current)
        }
        current.check();completion(images,null)
      } catch(_:InterruptedException) {
        // Lifecycle/input cancellation is silent; a resumed map starts its current scene.
      } catch(_:Exception) {
        if(!current.cancelled.get())completion(null,"Overlay image could not be loaded or decoded")
      } catch(_:OutOfMemoryError) {
        if(!current.cancelled.get())completion(null,"Overlay image could not be allocated")
      }
    }
  }
  private fun decode(uri:String,dimension:Int,job:Job):Bitmap {
    val temporary=File.createTempFile("enhanced-map-overlay-",null,context.cacheDir)
    try {
      val input:InputStream = when {
        !uri.contains(":") -> {
          val resource=context.resources.getIdentifier(uri,"drawable",context.packageName)
          require(resource!=0){"image resource was not found"}
          context.resources.openRawResource(resource)
        }
        uri.startsWith("asset:") -> context.assets.open(OverlayImagePath.asset(uri))
        uri.startsWith("file:") -> File(URI(uri)).inputStream()
        else -> {
          val call=OkHttpClientProvider.getOkHttpClient().newCall(Request.Builder().url(uri).build())
          job.call=call;job.check()
          val response=call.execute()
          if(!response.isSuccessful){response.close();throw IllegalArgumentException("HTTP ${response.code}")}
          response.body?.byteStream() ?: run {response.close();throw IllegalArgumentException("empty response")}
        }
      }
      job.stream=input
      input.use { source -> temporary.outputStream().use { output ->
        val buffer=ByteArray(DEFAULT_BUFFER_SIZE)
        while(true){job.check();val count=source.read(buffer);if(count<0)break;output.write(buffer,0,count)}
      } }
      job.stream=null;job.call=null;job.check()
      val bounds=BitmapFactory.Options().apply{inJustDecodeBounds=true;inScaled=false}
      BitmapFactory.decodeFile(temporary.path,bounds)
      var sample=ImageDecodeSize.sample(bounds.outWidth,bounds.outHeight,dimension)
      while(true) {
        job.check()
        try {
          val bitmap=BitmapFactory.decodeFile(temporary.path,BitmapFactory.Options().apply{inSampleSize=sample;inScaled=false;inPreferredConfig=Bitmap.Config.ARGB_8888})
          require(bitmap!=null){"invalid image data"}
          job.check()
          return bitmap
        } catch(failure:OutOfMemoryError) {
          if(sample.toLong()>=maxOf(bounds.outWidth,bounds.outHeight).toLong())throw failure
          sample=ImageDecodeSize.next(sample)
        }
      }
    } finally {try{job.stream?.close()}catch(_:Exception){};job.stream=null;job.call?.cancel();job.call=null;temporary.delete()}
  }
}
