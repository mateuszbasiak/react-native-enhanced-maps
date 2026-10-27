package com.enhancedmaps

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Rect
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.util.Base64
import android.text.Layout
import android.text.StaticLayout
import android.text.TextPaint
import org.maplibre.android.attribution.AttributionParser
import android.view.View
import org.json.JSONObject
import org.maplibre.android.maps.MapLibreMap
import java.io.ByteArrayOutputStream
import java.io.File
import java.util.UUID
import java.util.concurrent.ArrayBlockingQueue
import java.util.concurrent.ThreadPoolExecutor
import java.util.concurrent.TimeUnit
import java.util.concurrent.RejectedExecutionException

/** One mounted-map renderer capture. The owning host rejects concurrent requests. */
internal class MapSnapshot private constructor(
  private val view:View,
  private val completion:(JSONObject?,String?)->Unit
) {
  private val main=Handler(Looper.getMainLooper())
  private var finished=false
  private val timeout=Runnable { finish(null,"Snapshot timed out") }
  private fun finish(result:JSONObject?,error:String?) {
    check(Looper.myLooper()==Looper.getMainLooper())
    if(finished) {if(result!=null)discardResult(view,result);return}
    finished=true;main.removeCallbacks(timeout)
    main.post {completion(result,error)}
  }
  fun cancel() { finish(null,"Snapshot cancelled") }
  private fun begin(map:MapLibreMap,request:JSONObject) {
    require(Looper.myLooper()==Looper.getMainLooper()) {"Snapshot must start on the main thread"}
    require(view.isAttachedToWindow && view.width>0 && view.height>0 && map.style?.isFullyLoaded==true) {"Snapshot requires a mounted ready map"}
    require(view.width<=4096 && view.height<=4096 && view.width.toLong()*view.height<=16000000) {"Mounted viewport exceeds snapshot capture budget"}
    var width=request.getDouble("width");var height=request.getDouble("height")
    val quality=request.getDouble("quality")
    require(width.isFinite()&&height.isFinite()&&quality.isFinite()&&width>=0&&height>=0&&width<=4096&&height<=4096&&width%1.0==0.0&&height%1.0==0.0&&quality in 0.0..1.0) {"Invalid snapshot dimensions or quality"}
    if(width==0.0&&height==0.0) {width=view.width.toDouble();height=view.height.toDouble()}
    else if(width==0.0)width=kotlin.math.round(height*view.width/view.height)
    else if(height==0.0)height=kotlin.math.round(width*view.height/view.width)
    require(width>=1&&height>=1&&width<=4096&&height<=4096&&width*height<=16000000) {"Snapshot exceeds pixel budget"}
    val format=request.getString("format");val resultType=request.getString("result")
    require(format in listOf("png","jpg")&&resultType in listOf("file","base64")) {"Invalid snapshot output"}
    val outputWidth=width.toInt();val outputHeight=height.toInt()
    val attributionData=map.style?.sources?.mapNotNull {source->source.attribution?.takeIf {it.isNotBlank()}}.orEmpty()
    require(attributionData.sumOf {it.length}<=8192) {"Snapshot attribution exceeds text budget"}
    val attributions=AttributionParser.Options(view.context).withAttributionData(*attributionData.toTypedArray()).withImproveMap(false).withCopyrightSign(true).build().attributions
    val attributionText=(listOf("MapLibre")+attributions.map {"${it.title} (${it.url})"}).distinct().joinToString(" · ")
    val attributionPaint=TextPaint(Paint.ANTI_ALIAS_FLAG).apply {color=Color.BLACK;textSize=12f}
    require(outputWidth>=32) {"Snapshot is too small to show attribution"}
    val attributionLayout=StaticLayout.Builder.obtain(attributionText,0,attributionText.length,attributionPaint,outputWidth-8).setAlignment(Layout.Alignment.ALIGN_NORMAL).setIncludePad(false).build()
    require(attributionLayout.height+8<outputHeight) {"Snapshot is too small to show attribution"}
    main.postDelayed(timeout,4000)
    // Public MapLibre capture includes active style geometry and symbol markers.
    // The host must reject active custom shader layers for portable semantics.
    map.snapshot { captured ->
      if(finished)return@snapshot
      if(captured==null) {finish(null,"Could not render snapshot");return@snapshot}
      try {
        encoder.execute {
          var output:Bitmap?=null
          var result:JSONObject?=null
          var failure:String?=null
          try {
            output=Bitmap.createBitmap(outputWidth,outputHeight,Bitmap.Config.ARGB_8888)
            val canvas=Canvas(output)
            if(format=="jpg")canvas.drawColor(Color.WHITE)
            canvas.drawBitmap(captured,null,Rect(0,0,outputWidth,outputHeight),Paint(Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG))
            // Preserve non-interactive credits: an attribution icon alone cannot
            // reveal source names/links in a static exported image.
            val attributionTop=outputHeight-attributionLayout.height-8
            canvas.drawRect(0f,attributionTop.toFloat(),outputWidth.toFloat(),outputHeight.toFloat(),Paint().apply {color=0xEEFFFFFF.toInt()})
            canvas.save();canvas.translate(4f,attributionTop+4f);attributionLayout.draw(canvas);canvas.restore()
            val bytes=BoundedOutput()
            require(output.compress(if(format=="jpg")Bitmap.CompressFormat.JPEG else Bitmap.CompressFormat.PNG,(quality*100).toInt(),bytes)) {"Could not encode snapshot"}
            val data=bytes.toByteArray()
            require(data.isNotEmpty()&&data.size<=MAX_BYTES) {"Snapshot exceeds encoded byte budget"}
            result=if(resultType=="base64")JSONObject().put("value",Base64.encodeToString(data,Base64.NO_WRAP)).put("file",false)
            else {
              val directory=directory(view);prune(directory)
              val file=File(directory,"map-${UUID.randomUUID()}.$format")
              try {file.writeBytes(data)} catch(error:Exception) {file.delete();throw error}
              JSONObject().put("value",Uri.fromFile(file).toString()).put("file",true)
            }
          } catch(error:Exception) {failure=error.message ?: "Could not encode snapshot"}
          finally {output?.recycle()}
          main.post {finish(result,failure)}
        }
      } catch(error:RejectedExecutionException) {finish(null,"Snapshot encoder is busy")}
    }
  }
  companion object {
    private const val MAX_BYTES=32*1024*1024
    private val encoder=ThreadPoolExecutor(1,1,0L,TimeUnit.MILLISECONDS,ArrayBlockingQueue<Runnable>(4),{task->Thread(task,"EnhancedMapsSnapshot").apply {isDaemon=true}})
    private fun directory(view:View)=File(view.context.cacheDir,"enhanced-map-snapshots").apply {require(isDirectory||mkdirs()) {"Could not create snapshot cache"}}
    private fun prune(directory:File) {
      val files=directory.listFiles()?.filter {it.isFile}?.sortedBy {it.lastModified()} ?: return
      var count=files.size
      val cutoff=System.currentTimeMillis()-86400000L
      for(file in files)if(count>=16||file.lastModified()<cutoff) {file.delete();count--}
    }
    fun start(map:MapLibreMap,view:View,request:JSONObject,completion:(JSONObject?,String?)->Unit):MapSnapshot {
      val operation=MapSnapshot(view,completion)
      try {operation.begin(map,request)} catch(error:Exception) {operation.finish(null,error.message?:"Could not capture map")}
      return operation
    }
    fun discardResult(view:View,result:JSONObject) {
      // Best-effort cleanup must never crash a detached/disposed host.
      runCatching {
        if(!result.optBoolean("file"))return
        val uri=Uri.parse(result.optString("value"))
        if(uri.scheme!="file")return
        val file=File(uri.path?:return)
        if(file.parentFile?.canonicalPath==directory(view).canonicalPath)file.delete()
      }
    }
  }
  private class BoundedOutput:ByteArrayOutputStream() {
    @Synchronized override fun write(value:Int) {require(count<MAX_BYTES) {"Snapshot exceeds encoded byte budget"};super.write(value)}
    @Synchronized override fun write(buffer:ByteArray,offset:Int,length:Int) {require(length>=0&&count.toLong()+length<=MAX_BYTES) {"Snapshot exceeds encoded byte budget"};super.write(buffer,offset,length)}
  }
}
