export const shaderFrameByteLength = 160;
export interface ShaderPrograms {
  readonly vertex?: string;
  readonly fragment: string;
  readonly compute?: string;
  readonly vertexEntryPoint?: string;
  readonly fragmentEntryPoint?: string;
  readonly computeEntryPoint?: string;
}
export interface ShaderFrame {
  /** Actual fractional camera zoom. */
  readonly zoom: number;
  readonly time: number;
  readonly delta: number;
  /** Physical output pixels: scaled viewport dimensions, including the offscreen guard band. */
  readonly width: number;
  readonly height: number;
}
export interface ShaderSimulation {
  /** One persistent layer-wide storage buffer, at group 0 / binding 2. */
  readonly byteLength: number;
  readonly initialData?: readonly number[];
  readonly workgroups: readonly [number, number?, number?];
}
/** Float32 samples at grid nodes, row-major from north-west to south-east.
 * Vector channels are eastward then northward; units are descriptive, never converted.
 * Longitude bounds are unwrapped: use [170, south, 190, north] across the dateline.
 */
export interface ShaderGrid {
  readonly width: number;
  readonly height: number;
  readonly bounds: readonly [
    west: number,
    south: number,
    east: number,
    north: number,
  ];
  readonly projection: 'mercator' | 'equirectangular';
  readonly channels: 1 | 2;
  readonly units: string;
  readonly interpolation: 'nearest' | 'linear';
  readonly values: readonly number[];
  /** One validity flag per node: 1 is valid, 0 is missing. */
  readonly mask?: readonly number[];
}
export interface ShaderGridPacket {
  readonly values: readonly number[];
  readonly metadata: readonly number[];
}
export function validateShaderGrid(data: ShaderGrid): void {
  const { width, height, bounds, channels, values, mask } = data;
  if (
    !Number.isSafeInteger(width) ||
    width < 1 ||
    !Number.isSafeInteger(height) ||
    height < 1 ||
    width * height > 1048576
  )
    throw new RangeError(
      'Shader grid must contain 1 to 1048576 nodes (16 MiB packed)',
    );
  if (
    !Array.isArray(bounds) ||
    bounds.length !== 4 ||
    !Array.from(bounds).every(
      (v) => typeof v === 'number' && Number.isFinite(v),
    ) ||
    bounds[0] < -180 ||
    bounds[0] > 180 ||
    bounds[2] <= bounds[0] ||
    bounds[2] - bounds[0] > 360 ||
    bounds[1] < -85.0511287798066 ||
    bounds[3] > 85.0511287798066 ||
    bounds[3] <= bounds[1]
  )
    throw new RangeError('Invalid shader grid geographic bounds');
  if (
    ![1, 2].includes(channels) ||
    !['mercator', 'equirectangular'].includes(data.projection) ||
    !['nearest', 'linear'].includes(data.interpolation) ||
    typeof data.units !== 'string' ||
    !data.units.trim() ||
    data.units.length > 128
  )
    throw new Error(
      'Invalid shader grid layout, projection, interpolation or units',
    );
  if (
    !Array.isArray(values) ||
    values.length !== width * height * channels ||
    !Array.from(values).every(
      (v) =>
        typeof v === 'number' &&
        Number.isFinite(v) &&
        Math.abs(v) <= 3.4028234663852886e38,
    ) ||
    (mask !== undefined &&
      (!Array.isArray(mask) ||
        mask.length !== width * height ||
        !Array.from(mask).every((v) => v === 0 || v === 1)))
  )
    throw new RangeError('Invalid shader grid values or validity mask');
}
export function packShaderGrid(data: ShaderGrid | undefined): ShaderGridPacket {
  if (!data) return { values: [0, 0, 0, 0], metadata: Array(12).fill(0) };
  validateShaderGrid(data);
  const { width, height, bounds, channels, values, mask } = data;
  const packed = new Array<number>(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    packed[i * 4] = values[i * channels]!;
    packed[i * 4 + 1] = channels === 2 ? values[i * channels + 1]! : 0;
    packed[i * 4 + 2] = mask?.[i] ?? 1;
    packed[i * 4 + 3] = 0;
  }
  return {
    values: packed,
    metadata: [
      ...bounds,
      width,
      height,
      channels,
      data.interpolation === 'linear' ? 1 : 0,
      data.projection === 'equirectangular' ? 1 : 0,
      1,
      (1 -
        Math.log(Math.tan(Math.PI / 4 + (bounds[3] * Math.PI) / 360)) /
          Math.PI) /
        2,
      (1 -
        Math.log(Math.tan(Math.PI / 4 + (bounds[1] * Math.PI) / 360)) /
          Math.PI) /
        2,
    ],
  };
}
export interface ShaderLayerProps {
  readonly id: string;
  readonly coverage?: 'world';
  /** Viewport raster density relative to device pixels; 0.25–1, default 0.5. */
  readonly resolutionScale?: number;
  readonly shaders: ShaderPrograms;
  /** Replace immutably to upload a new grid without resetting simulation. */
  readonly data?: ShaderGrid;
  /** Inclusive lower and exclusive upper camera zoom limits. */
  readonly minZoom?: number;
  readonly maxZoom?: number;
  /** Packed f32 data at group 0 / binding 1. Functions must contain 'worklet'. */
  readonly uniforms?:
    readonly number[] | ((frame: ShaderFrame) => readonly number[]);
  readonly simulation?: ShaderSimulation;
  readonly vertexCount?: number;
  readonly instanceCount?: number;
  readonly beforeId?: string;
  readonly placement?: 'below-labels' | 'above-labels';
  readonly paused?: boolean;
  readonly visible?: boolean;
  readonly allowSoftwareAdapter?: boolean;
  readonly onReady?: () => void;
  readonly onError?: (error: Error) => void;
}
/** Injected into every stage. Coordinates are normalized Web Mercator, with unwrapped longitude. */
export const shaderPrelude = /* wgsl */ `
struct MapShaderFrame {
 time:f32, delta:f32, resolution:vec2f,
 worldOrigin:vec2f, padding0:vec2f,
 viewMin:vec2f, viewMax:vec2f,
 zoom:f32, pixelRatio:f32, padding1:vec2f,
 worldToClip:mat3x3f, clipToWorld:mat3x3f,
};
@group(0) @binding(0) var<uniform> frame:MapShaderFrame;
fn mapWorldPosition(uv:vec2f)->vec2f {
 let p=frame.clipToWorld*vec3f(uv.x*2.0-1.0,1.0-uv.y*2.0,1.0);
 return frame.worldOrigin+p.xy/p.z;
}
fn mapScreenPosition(world:vec2f)->vec4f {
 var relative=world-frame.worldOrigin;relative.x-=round(relative.x);
 let p=frame.worldToClip*vec3f(relative,1);
 return vec4f(p.xy,0,p.z);
}
// Subtract the binary-aligned camera origin before adding small local offsets.
fn mapRelativeScreenPosition(origin:vec2f,offset:vec2f)->vec4f {
 var relative=origin-frame.worldOrigin;relative.x-=round(relative.x+offset.x);
 let p=frame.worldToClip*vec3f(relative+offset,1);
 return vec4f(p.xy,0,p.z);
}
fn mapLngLat(world:vec2f)->vec2f { return vec2f(fract(world.x)*360.0-180.0,atan(sinh(3.14159265359*(1.0-2.0*world.y)))*57.2957795131); }
`;
/** Geographic scalar/vector sampling, available in vertex, fragment and compute. */
export const shaderGridPrelude = /* wgsl */ `
struct MapGridMetadata {
 bounds:vec4f, shape:vec4f, options:vec4f,
};
@group(0) @binding(3) var<storage,read> mapGridValues:array<vec4f>;
@group(0) @binding(4) var<uniform> mapGrid:MapGridMetadata;
struct MapGridSample { value:vec2f, valid:f32 };
fn mapGridMercatorY(latitude:f32)->f32 {
 let radians=latitude*0.0174532925199433;
 return (1.0-log(tan(0.7853981633974483+radians*0.5))/3.141592653589793)*0.5;
}
// Returns geographic UV, including outside [0,1] for locations beyond coverage.
fn mapGridUV(world:vec2f)->vec2f {
 let b=mapGrid.bounds;
 let x=world.x+round((b.x+b.z)/720.0+0.5-world.x);
 let u=(x*360.0-180.0-b.x)/(b.z-b.x);
 var v=(world.y-mapGrid.options.z)/(mapGrid.options.w-mapGrid.options.z);
 if(mapGrid.options.x>0.5) { v=(b.w-mapLngLat(world).y)/(b.w-b.y); }
 if(world.y==mapGrid.options.z) { v=0.0; }
 if(world.y==mapGrid.options.w) { v=1.0; }
 return vec2f(u,v);
}
fn mapGridNode(node:vec2u)->vec4f {
 return mapGridValues[node.y*u32(mapGrid.shape.x)+node.x];
}
// Missing nodes with nonzero interpolation weight invalidate the sample.
// No extrapolation beyond bounds; invalid samples have zero value.
fn mapSampleGrid(world:vec2f)->MapGridSample {
 if(mapGrid.options.y<0.5) { return MapGridSample(vec2f(0),0); }
 var uv=mapGridUV(world);
 // Float32 projection arithmetic can move exact boundary nodes a few ulps.
 if(any(uv<vec2f(-0.000001)) || any(uv>vec2f(1.000001))) { return MapGridSample(vec2f(0),0); }
 uv=clamp(uv,vec2f(0),vec2f(1));
 uv=select(uv,round(uv),abs(uv-round(uv))<vec2f(0.000001));
 let p=uv*(mapGrid.shape.xy-vec2f(1));
 if(mapGrid.shape.w<0.5) {
  let node=mapGridNode(vec2u(floor(p+vec2f(0.5))));
  return MapGridSample(select(vec2f(0),node.xy,node.z>0.5),node.z);
 }
 let low=vec2u(floor(p));
 let high=min(low+vec2u(1),vec2u(mapGrid.shape.xy)-vec2u(1));
 let f=fract(p);
 let weights=vec4f((1.0-f.x)*(1.0-f.y),f.x*(1.0-f.y),(1.0-f.x)*f.y,f.x*f.y);
 let a=mapGridNode(low);let b=mapGridNode(vec2u(high.x,low.y));
 let c=mapGridNode(vec2u(low.x,high.y));let d=mapGridNode(high);
 if(any((weights>vec4f(0)) & (vec4f(a.z,b.z,c.z,d.z)<vec4f(0.5)))) {
  return MapGridSample(vec2f(0),0);
 }
 return MapGridSample(a.xy*weights.x+b.xy*weights.y+c.xy*weights.z+d.xy*weights.w,1);
}
`;
export const defaultShaderVertex = /* wgsl */ `
struct MapShaderVertex { @builtin(position) position:vec4f, @location(0) @interpolate(linear) uv:vec2f, @location(1) world:vec2f };
@vertex fn vertexMain(@builtin(vertex_index) index:u32)->MapShaderVertex {
 let p=array<vec2f,6>(vec2f(-1,-1),vec2f(1,-1),vec2f(-1,1),vec2f(-1,1),vec2f(1,-1),vec2f(1,1))[index];
 var out:MapShaderVertex;
 let uv=vec2f((p.x+1)*0.5,(1-p.y)*0.5);
 // Actual viewport corners avoid the ground horizon outside an oversized triangle.
 let ground=frame.clipToWorld*vec3f(p,1);let w=1.0/ground.z;
 out.position=vec4f(p*w,0,w);out.uv=uv;out.world=mapWorldPosition(uv);return out;
}`;
export function packShaderUniforms(values: readonly number[]): Float32Array {
  'worklet';
  if (!Array.isArray(values) || values.length > 1024)
    throw new RangeError(
      'Shader uniforms require at most 1024 packed f32 values',
    );
  const out = new Float32Array(Math.max(4, Math.ceil(values.length / 4) * 4));
  for (let i = 0; i < values.length; i++) {
    const value = values[i]!;
    if (
      typeof value !== 'number' ||
      !Number.isFinite(value) ||
      Math.abs(value) > 3.4028234663852886e38
    )
      throw new RangeError('Shader uniforms must contain finite f32 values');
    out[i] = value;
  }
  return out;
}
export function validateShaderLayer(p: ShaderLayerProps): ShaderLayerProps {
  if (p.data) validateShaderGrid(p.data);
  return validateShaderOptions(p);
}
/** Validate changing layer options separately from potentially large immutable grids. */
export function validateShaderOptions(p: ShaderLayerProps): ShaderLayerProps {
  if (
    p.resolutionScale !== undefined &&
    (!Number.isFinite(p.resolutionScale) ||
      p.resolutionScale < 0.25 ||
      p.resolutionScale > 1)
  )
    throw new RangeError('Shader resolutionScale must be between 0.25 and 1');
  for (const zoom of [p.minZoom, p.maxZoom])
    if (zoom !== undefined && !Number.isFinite(zoom))
      throw new RangeError('Shader zoom limits must be finite');
  if ((p.minZoom ?? -Infinity) >= (p.maxZoom ?? Infinity))
    throw new RangeError('Shader minZoom must be below maxZoom');

  const id = (v: unknown) =>
    typeof v === 'string' && /^[a-zA-Z0-9_.:-]{1,128}$/.test(v);
  if (
    !id(p.id) ||
    (p.beforeId !== undefined && (!id(p.beforeId) || p.beforeId === p.id))
  )
    throw new Error('Invalid shader layer id or beforeId');
  if (p.coverage !== undefined && p.coverage !== 'world')
    throw new Error('Shader coverage must be world');
  if (
    p.placement !== undefined &&
    !['below-labels', 'above-labels'].includes(p.placement)
  )
    throw new Error('Invalid shader layer placement');
  for (const source of [
    p.shaders?.fragment,
    p.shaders?.vertex ?? defaultShaderVertex,
    ...(p.shaders?.compute !== undefined ? [p.shaders.compute] : []),
  ])
    if (typeof source !== 'string' || !source.trim() || source.length > 262144)
      throw new Error(
        'Shader source must be nonempty WGSL, at most 256 KiB characters',
      );
  for (const entry of [
    p.shaders.vertexEntryPoint ?? 'vertexMain',
    p.shaders.fragmentEntryPoint ?? 'fragmentMain',
    p.shaders.computeEntryPoint ?? 'computeMain',
  ])
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(entry))
      throw new Error('Invalid shader entry point');
  for (const count of [p.vertexCount ?? 3, p.instanceCount ?? 1])
    if (!Number.isSafeInteger(count) || count < 1 || count > 1048576)
      throw new RangeError('Invalid shader draw count');
  if ((p.vertexCount ?? 3) * (p.instanceCount ?? 1) > 6291456)
    throw new RangeError('Shader draw budget exceeded');
  if (p.uniforms !== undefined && typeof p.uniforms !== 'function')
    packShaderUniforms(p.uniforms);
  if (p.shaders.compute && !p.simulation)
    throw new Error('Compute shader requires a simulation buffer');
  if (p.simulation) {
    const s = p.simulation;
    if (
      !Number.isSafeInteger(s.byteLength) ||
      s.byteLength < 16 ||
      s.byteLength > 16777216 ||
      s.byteLength % 16
    )
      throw new RangeError(
        'Simulation buffer must be 16-byte aligned, at most 16 MiB',
      );
    if (s.initialData) {
      if (
        s.initialData.length * 4 > s.byteLength ||
        !s.initialData.every(
          (v) =>
            typeof v === 'number' &&
            Number.isFinite(v) &&
            Math.abs(v) <= 3.4028234663852886e38,
        )
      )
        throw new RangeError('Invalid simulation initial data');
    }
    if (
      s.workgroups.length < 1 ||
      s.workgroups.length > 3 ||
      s.workgroups.some((v) => !Number.isInteger(v) || v! < 1 || v! > 65535) ||
      s.workgroups.reduce<number>((a, b) => a * (b ?? 1), 1) > 65535
    )
      throw new RangeError('Invalid compute workgroup budget');
  }
  return p;
}
