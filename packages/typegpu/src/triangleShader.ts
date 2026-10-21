import tgpu from 'typegpu';
import * as d from 'typegpu/data';

export const triangleVertex = tgpu
  .vertexFn({
    in: { index: d.builtin.vertexIndex },
    out: { position: d.builtin.position },
  })(
    `{
  var positions = array<vec2f, 3>(vec2f(0.0, 0.85), vec2f(-0.85, -0.85), vec2f(0.85, -0.85));
  return Out(vec4f(positions[index], 0.0, 1.0));
}`,
  )
  .$name('triangleVertex');
