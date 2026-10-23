export interface ShaderPrograms {
  readonly vertex?: string;
  readonly fragment: string;
  readonly compute?: string;
  readonly vertexEntryPoint?: string;
  readonly fragmentEntryPoint?: string;
  readonly computeEntryPoint?: string;
}
export interface ShaderFrame {
  readonly time: number;
  readonly delta: number;
  readonly width: number;
  readonly height: number;
}
export interface ShaderSimulation {
  /** One persistent layer-wide storage buffer, at group 0 / binding 2. */
  readonly byteLength: number;
  readonly initialData?: readonly number[];
  readonly workgroups: readonly [number, number?, number?];
}
export interface ShaderLayerProps {
  readonly id: string;
  readonly coverage?: 'world';
  readonly shaders: ShaderPrograms;
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
 tileOrigin:vec2f, tileScale:f32, tileZoom:f32,
 viewMin:vec2f, viewMax:vec2f,
};
@group(0) @binding(0) var<uniform> frame:MapShaderFrame;
fn mapWorldPosition(uv:vec2f)->vec2f { return frame.tileOrigin + ((uv*256.0-2.0)/252.0)*frame.tileScale; }
fn mapTilePosition(world:vec2f)->vec4f {
 var p=world;
 p.x += round(frame.tileOrigin.x+frame.tileScale*0.5-p.x);
 let uv=((p-frame.tileOrigin)/frame.tileScale*252.0+2.0)/256.0;
 return vec4f(uv.x*2.0-1.0,1.0-uv.y*2.0,0.0,1.0);
}
fn mapLngLat(world:vec2f)->vec2f { return vec2f(fract(world.x)*360.0-180.0,atan(sinh(3.14159265359*(1.0-2.0*world.y)))*57.2957795131); }
`;
export const defaultShaderVertex = /* wgsl */ `
struct MapShaderVertex { @builtin(position) position:vec4f, @location(0) uv:vec2f, @location(1) world:vec2f };
@vertex fn vertexMain(@builtin(vertex_index) index:u32)->MapShaderVertex {
 let p=array<vec2f,3>(vec2f(-1,-1),vec2f(3,-1),vec2f(-1,3))[index];
 var out:MapShaderVertex;out.position=vec4f(p,0,1);
 let uv=vec2f((p.x+1)*0.5,(1-p.y)*0.5);
 out.uv=(uv*256.0-2.0)/252.0;out.world=mapWorldPosition(uv);return out;
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
