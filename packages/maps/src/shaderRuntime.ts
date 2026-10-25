import type { WorkletRuntime } from 'react-native-worklets';

/** Native runtimes are expensive and not promptly collected with their JS wrappers. */
export function createShaderRuntimeCache<T extends object>() {
  let runtime: T | undefined;
  return (create: () => T): T => (runtime ??= create());
}
/** One rendering worker per JS bundle, with separate per-layer frame/resource state. */
export const getShaderRuntime = createShaderRuntimeCache<WorkletRuntime>();
