package com.enhancedmaps

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Bundle
import android.os.Looper
import android.os.SystemClock
import org.json.JSONObject

/** Foreground-only platform location stream. The application owns permission requests. Main thread only. */
internal class MapUserLocation(
  context:Context,
  private var location:((String)->Unit)?,
  private var error:((String,String)->Unit)?
) : LocationListener {
  private val context=context.applicationContext
  private val manager=context.getSystemService(Context.LOCATION_SERVICE) as? LocationManager
  private var enabled=false
  private var paused=true
  private var closed=false
  private var running=false
  private var lastError:String?=null
  private var lastTimestamp=0L
  private var lastAccuracy=Float.POSITIVE_INFINITY
  private fun report(code:String,message:String) {
    if(closed || lastError==code)return
    lastError=code;error?.invoke(code,message)
  }
  private fun stop() {
    if(running)try { manager?.removeUpdates(this) } catch(_:SecurityException) {}
    running=false
  }
  private fun reconcile() {
    if(closed || !enabled || paused) {stop();return}
    val fine=context.checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION)==PackageManager.PERMISSION_GRANTED
    val coarse=context.checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION)==PackageManager.PERMISSION_GRANTED
    if(!fine && !coarse) {stop();report("location-permission","Location permission must be granted by the application before showing native user location");return}
    val service=manager ?: run {report("location-unavailable","Location services are unavailable");return}
    if(running)return
    try {
      val providers=service.getProviders(true).filter {it==LocationManager.NETWORK_PROVIDER || (fine && it==LocationManager.GPS_PROVIDER)}
      if(providers.isEmpty()) {report("location-unavailable","No authorized location provider is enabled");return}
      running=true
      providers.forEach { service.requestLocationUpdates(it,1000L,0f,this,Looper.getMainLooper()) }
      lastError=null
    } catch(_:SecurityException) {stop();report("location-permission","Location permission was denied or revoked")}
      catch(_:IllegalArgumentException) {stop();report("location-unavailable","Location provider is unavailable")}
  }
  fun configure(value:Boolean) {
    if(closed)return
    if(enabled!=value) {lastError=null;lastTimestamp=0;lastAccuracy=Float.POSITIVE_INFINITY}
    enabled=value;reconcile()
  }
  fun pause() {if(!closed){paused=true;stop()}}
  fun resume() {if(!closed){paused=false;reconcile()}}
  fun close() {if(closed)return;closed=true;stop();enabled=false;location=null;error=null}
  override fun onLocationChanged(fix:Location) {
    if(closed || !enabled || paused || !running)return
    val latitude=fix.latitude;val longitude=fix.longitude
    if(!latitude.isFinite() || !longitude.isFinite() || kotlin.math.abs(latitude)>90 || kotlin.math.abs(longitude)>180 || !fix.hasAccuracy() || !fix.accuracy.isFinite() || fix.accuracy<0)return
    val elapsedAge=SystemClock.elapsedRealtimeNanos()-fix.elapsedRealtimeNanos
    if(elapsedAge>30_000_000_000L || elapsedAge < -60_000_000_000L)return
    if(fix.time<0 || fix.time<lastTimestamp || (fix.time==lastTimestamp && fix.accuracy>=lastAccuracy))return
    lastTimestamp=fix.time;lastAccuracy=fix.accuracy
    val value=JSONObject().put("latitude",latitude).put("longitude",longitude).put("accuracy",fix.accuracy.toDouble()).put("timestamp",fix.time)
    if(fix.hasAltitude() && fix.altitude.isFinite())value.put("altitude",fix.altitude)
    if(fix.hasBearing() && fix.bearing.isFinite() && fix.bearing>=0 && fix.bearing<360)value.put("heading",fix.bearing.toDouble())
    if(fix.hasSpeed() && fix.speed.isFinite() && fix.speed>=0)value.put("speed",fix.speed.toDouble())
    location?.invoke(value.toString())
  }
  override fun onProviderEnabled(provider:String) {if(enabled && !paused){stop();reconcile()}}
  override fun onProviderDisabled(provider:String) {if(enabled && !paused){stop();reconcile()}}
  @Deprecated("Android legacy location callback")
  override fun onStatusChanged(provider:String?,status:Int,extras:Bundle?) {}
}
