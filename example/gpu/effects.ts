/**
 * Example-owned GPU programs. Edit these strings or supply another function with
 * the same signature; native code contains no wave/radar/checkerboard algorithm.
 *
 * Prototype ABI: UV is south-to-north over the geographic quad; time is native
 * seconds; color is RGBA; parameters is a programmer-controlled float4.
 * Return premultiplied RGBA. This backend accepts Metal, not TypeScript/WGSL.
 */
export const effects = {
  waves: `
float4 mapEffect(float2 uv, float time, float4 color, float4 parameters) {
  float bend = 0.055 * sin(uv.x * 13.0 - time * 0.7);
  float wave = pow(0.5 + 0.5 * sin((uv.y + bend) * parameters.x - uv.x * 15.0 - time * 3.0), 12.0);
  float pulse = 0.5 + 0.5 * sin(uv.x * 55.0 - time * 2.0);
  float edge = smoothstep(0.0, 0.025, min(min(uv.x, uv.y), min(1.0 - uv.x, 1.0 - uv.y)));
  float a = color.a * edge * (0.18 + 0.68 * wave * (0.5 + 0.5 * pulse));
  return float4(color.rgb * a, a);
}`,
  radar: `
float4 mapEffect(float2 uv, float time, float4 color, float4 parameters) {
  float2 p = (uv - 0.5) * 2.0;
  float r = length(p);
  float angle = atan2(p.y, p.x);
  float sweep = pow(0.5 + 0.5 * cos(angle - time * 1.5), 18.0);
  float rings = pow(0.5 + 0.5 * cos(r * parameters.x - time * 4.0), 20.0);
  float a = color.a * (1.0 - smoothstep(0.85, 1.0, r)) * (0.1 + 0.65 * sweep + 0.2 * rings);
  return float4(color.rgb * a, a);
}`,
  checkerboard: `
float4 mapEffect(float2 uv, float time, float4 color, float4 parameters) {
  float2 cell = floor(uv * parameters.x * 0.15 + float2(time, 0.0));
  float checker = fmod(cell.x + cell.y, 2.0);
  float a = color.a * mix(0.08, 0.7, checker);
  return float4(color.rgb * a, a);
}`,
};
export type EffectName = keyof typeof effects;
