import type { Synchronizable } from 'react-native-worklets';
import type { ShaderControl } from './shaderWorklet';

export interface ShaderControlChannel {
  readonly synchronizable: Synchronizable<ShaderControl>;
  update(
    patch:
      | Partial<ShaderControl>
      | ((previous: ShaderControl) => Partial<ShaderControl>),
  ): void;
}
/** Keep the original RN-side worklets: reading them back from another runtime
 * and serializing that rebound copy can turn them into remote JS functions.
 */
export function createShaderControlChannel(
  initial: ShaderControl,
  create: (state: ShaderControl) => Synchronizable<ShaderControl>,
): ShaderControlChannel {
  let state = initial;
  const synchronizable = create(state);
  return {
    synchronizable,
    update(patch) {
      state = {
        ...state,
        ...(typeof patch === 'function' ? patch(state) : patch),
      };
      synchronizable.setBlocking(state);
    },
  };
}
