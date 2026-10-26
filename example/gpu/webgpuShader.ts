import type { ShaderGrid } from 'react-native-enhanced-maps/shaders';
/** Synthetic sampled field demonstrates the input format; not a forecast. */
export const windGrid: ShaderGrid = {
  width: 16,
  height: 16,
  bounds: [18, 54, 19, 55],
  projection: 'equirectangular',
  channels: 2,
  units: 'm/s',
  interpolation: 'linear',
  values: Array.from({ length: 16 * 16 }, (_, i) => [
    12 + 6 * Math.sin(Math.floor(i / 16) * 0.4),
    4 * Math.cos((i % 16) * 0.4),
  ]).flat(),
  mask: Array.from({ length: 16 * 16 }, (_, i) =>
    i % 16 < 2 && Math.floor(i / 16) < 2 ? 0 : 1,
  ),
};
/** Procedural shader evaluated in continuous world coordinates, unchanged across tiles/platforms. */
export const shaderSource = /* wgsl */ `
struct Uniforms { params:vec4f, tint:vec4f };
@group(0) @binding(1) var<uniform> uniforms:Uniforms;
@fragment fn fragmentMain(@location(0) uv:vec2f,@location(1) world:vec2f)->@location(0) vec4f {
 let p=world*4096.0;
 let bend=0.15*sin(p.x*6.2831853-frame.time*0.7);
 let wave=pow(0.5+0.5*sin((p.y+bend)*25.1327412-p.x*6.2831853-frame.time*3.0),12.0);
 let checker=(floor(p.x*8.0+frame.time)+floor(p.y*8.0))%2.0;
 let intensity=select(0.08+wave*0.6,mix(0.08,0.7,checker),uniforms.params.x>1.5);
 let alpha=uniforms.tint.a*intensity;
 return vec4f(uniforms.tint.rgb*alpha,alpha);
}`;
const particles = /* wgsl */ `
struct Particle {
 position:vec2f, tail:vec2f, age:f32, seed:f32, origin:vec2f,
 history:array<vec2f,10>, timing:vec4f,
};
struct WindDisplay { params:vec4f, tint:vec4f };
// Visual speed scale, trail sample spacing, width in screen pixels, density fraction.
@group(0) @binding(1) var<uniform> display:WindDisplay;
`;
export const windCompute =
  particles +
  /* wgsl */ `
@group(0) @binding(2) var<storage,read_write> particles:array<Particle>;
fn random(n:f32)->f32 {return fract(sin(n*127.1+311.7)*43758.5453);}
@compute @workgroup_size(64) fn computeMain(@builtin(global_invocation_id) gid:vec3u) {
 let i=gid.x;if(i>=arrayLength(&particles)){return;}
 var p=particles[i];let span=frame.viewMax-frame.viewMin;
 let margin=span*0.3;let b=mapGrid.bounds;
 var fieldMin=vec2f((b.x+180.0)/360.0,mapGrid.options.z);
 var fieldMax=vec2f((b.z+180.0)/360.0,mapGrid.options.w);
 let shift=round((frame.viewMin.x+frame.viewMax.x-fieldMin.x-fieldMax.x)*0.5);
 fieldMin.x+=shift;fieldMax.x+=shift;
 let low=max(frame.viewMin-margin,fieldMin);let high=min(frame.viewMax+margin,fieldMax);
 if(any(high<=low)) { p.seed=0.0;particles[i]=p;return; }
 var world=p.origin+p.position;
 world.x+=round((frame.viewMin.x+frame.viewMax.x)*0.5-world.x);
 p.age+=frame.delta;
 if(p.seed==0.0 || p.age>p.timing.y || any(world<low) || any(world>high)) {
  let seed=f32(i)+floor(frame.time*0.5)*0.17;
  // Local coordinates retain centimetre-scale updates at 60 Hz.
  p.origin=(low+high)*0.5;
  p.position=(low-p.origin)+vec2f(random(seed+1.0),random(seed+2.0))*(high-low);
  p.tail=p.position;p.seed=1.0;
  p.timing=vec4f(0,4.5+random(seed+4.0)*3.0,0,0);
  p.age=random(seed+3.0)*p.timing.y*0.85;
  for(var j=0u;j<10u;j++) { p.history[j]=p.position; }
 } else {
  let sample=mapSampleGrid(world);
  if(sample.valid<0.5) { p.seed=0.0;particles[i]=p;return; }
  let latitude=mapLngLat(world).y*0.0174532925199433;
  // Data stays in m/s; only the display motion is exaggerated for readability.
  let velocity=vec2f(sample.value.x,-sample.value.y)/(40075016.6856*cos(latitude));
  p.position+=velocity*frame.delta*display.params.x;
  p.timing.x+=frame.delta;
  let spacing=max(display.params.y,0.016);
  if(p.timing.x>=spacing) {
   for(var j=9u;j>0u;j--) { p.history[j]=p.history[j-1u]; }
   p.timing.x=p.timing.x%spacing;
  }
  p.history[0]=p.position;p.tail=p.history[9];
 }
 // One origin shift moves the head and every history point together.
 let wrap=floor(p.origin.x+p.position.x);p.origin.x-=wrap;
 particles[i]=p;
}`;
export const windVertex =
  particles +
  /* wgsl */ `
@group(0) @binding(2) var<storage,read> particles:array<Particle>;
struct ParticleVertex {
 @builtin(position) position:vec4f,
 @location(0) alpha:f32, @location(1) side:f32, @location(2) world:vec2f,
};
@vertex fn vertexMain(@builtin(vertex_index) v:u32,@builtin(instance_index) instance:u32)->ParticleVertex {
 let p=particles[instance];let segment=v/6u;
 let corner=array<vec2f,6>(vec2f(0,-1),vec2f(1,-1),vec2f(0,1),vec2f(0,1),vec2f(1,-1),vec2f(1,1))[v%6u];
 // Interpolate sample age so the whole tail advances every frame, not at 10 Hz.
 let phase=clamp(p.timing.x/max(display.params.y,0.016),0.0,1.0);
 let a=mix(p.history[segment+1u],p.history[segment],phase);
 var b=p.position;
 if(segment>0u) { b=mix(p.history[segment],p.history[segment-1u],phase); }
 let direction=b-a;
 let lengthSquared=dot(direction,direction);
 var out:ParticleVertex;
 // No undefined normalize(0), degenerate quads or uninitialized trail segments.
 if(p.seed==0.0 || lengthSquared<1e-24) {
  out.position=vec4f(2,2,0,1);out.alpha=0;out.side=0;out.world=p.origin;return out;
 }
 let normal=vec2f(-direction.y,direction.x)*inverseSqrt(lengthSquared);
 let along=1.0-(f32(segment)+1.0-corner.x)/9.0;
 let pixel=1.0/(512.0*exp2(frame.zoom));
 let width=display.params.z*(0.5+0.5*along);
 let halfWidth=pixel*width;
 // Cover adjacent atlas samples even when the desired line is sub-texel thin.
 let quadWidth=halfWidth+frame.tileScale/frame.resolution.x;
 let offset=mix(a,b,corner.x)+normal*corner.y*quadWidth;
 let world=p.origin+offset;
 let lifetime=smoothstep(0.0,0.6,p.age)*(1.0-smoothstep(p.timing.y-1.2,p.timing.y,p.age));
 let visible=select(0.0,1.0,f32(instance)/f32(arrayLength(&particles))<display.params.w);
 out.position=mapRelativeTilePosition(p.origin,offset);
 out.alpha=pow(along,1.15)*lifetime*p.seed*visible*smoothstep(8.0,10.0,frame.zoom);
 out.side=corner.y*quadWidth/halfWidth;out.world=world;return out;
}`;
export const windFragment = /* wgsl */ `
struct WindDisplay { params:vec4f, tint:vec4f };
@group(0) @binding(1) var<uniform> display:WindDisplay;
// Analytic box-filter coverage keeps subpixel lines stable as they move
// between atlas pixels, and rejects NaN/invalid interpolation before storage.
fn windCoverage(alpha:f32,side:f32,opacity:f32,filterWidth:f32)->f32 {
 if(!(alpha>=0.0 && alpha<=1.0) || !(opacity>=0.0 && opacity<=1.0) ||
    !(side>=-1e20 && side<=1e20) || !(filterWidth>0.0 && filterWidth<1e20)) { return 0.0; }
 let footprint=max(filterWidth,0.0001);
 let overlap=min(side+footprint*0.5,1.0)-max(side-footprint*0.5,-1.0);
 let a=alpha*opacity*clamp(overlap/footprint,0.0,1.0);
 if(!(a>0.0 && a<=1.0)) { return 0.0; }
 return a;
}
@fragment fn fragmentMain(@location(0) alpha:f32,@location(1) side:f32,@location(2) world:vec2f)->@location(0) vec4f {
 if(mapSampleGrid(world).valid<0.5) { discard; }
 let a=windCoverage(alpha,side,display.tint.a,fwidth(side));
 if(a==0.0) { discard; }
 return vec4f(display.tint.rgb*a,a);
}`;
