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
struct Particle { position:vec2f, tail:vec2f, age:f32, seed:f32, padding:vec2f };
`;
export const windCompute =
  particles +
  /* wgsl */ `
@group(0) @binding(2) var<storage,read_write> particles:array<Particle>;
fn random(n:f32)->f32 {return fract(sin(n*127.1+311.7)*43758.5453);}
@compute @workgroup_size(64) fn computeMain(@builtin(global_invocation_id) gid:vec3u) {
 let i=gid.x;if(i>=arrayLength(&particles)){return;}
 var p=particles[i];let span=frame.viewMax-frame.viewMin;
 let margin=span*0.3;let low=frame.viewMin-margin;let high=frame.viewMax+margin;
 // Keep canonical longitude, choosing the world copy nearest the current view.
 var world=p.position;world.x+=round((frame.viewMin.x+frame.viewMax.x)*0.5-world.x);
 p.age+=frame.delta;
 if(p.seed==0.0 || p.age>12.0 || any(world<low) || any(world>high)) {
  let seed=f32(i)+floor(frame.time*0.5)*0.17;
  p.position=low+vec2f(random(seed+1.0),random(seed+2.0))*(high-low);
  p.tail=p.position;p.age=random(seed+3.0)*5.0;p.seed=1.0;
 } else {
  let velocity=vec2f(1.0+0.5*sin(world.y*30000.0+frame.time*0.2),0.4*cos(world.x*20000.0-frame.time*0.1))*0.000012;
  p.tail=mix(p.tail,p.position,1.0-exp(-frame.delta*1.5));
  p.position+=velocity*frame.delta;
 }
 // Shift both endpoints together at the antimeridian; never draw a world-wide tail.
 let wrap=floor(p.position.x);p.position.x-=wrap;p.tail.x-=wrap;
 particles[i]=p;
}`;
export const windVertex =
  particles +
  /* wgsl */ `
@group(0) @binding(2) var<storage,read> particles:array<Particle>;
struct ParticleVertex { @builtin(position) position:vec4f, @location(0) alpha:f32 };
@vertex fn vertexMain(@builtin(vertex_index) v:u32,@builtin(instance_index) instance:u32)->ParticleVertex {
 let p=particles[instance];
 let corner=array<vec2f,6>(vec2f(0,-1),vec2f(1,-1),vec2f(0,1),vec2f(0,1),vec2f(1,-1),vec2f(1,1))[v];
 let direction=p.position-p.tail;
 let normal=normalize(vec2f(-direction.y,direction.x)+vec2f(1e-20));
 let world=mix(p.tail,p.position,corner.x)+normal*corner.y*frame.tileScale/252.0*0.8;
 var out:ParticleVertex;out.position=mapTilePosition(world);out.alpha=corner.x*smoothstep(0.0,0.5,p.age);return out;
}`;
export const windFragment = /* wgsl */ `
struct Uniforms { params:vec4f, tint:vec4f };
@group(0) @binding(1) var<uniform> uniforms:Uniforms;
@fragment fn fragmentMain(@location(0) alpha:f32)->@location(0) vec4f {
 let a=alpha*uniforms.tint.a;return vec4f(uniforms.tint.rgb*a,a);
}`;
