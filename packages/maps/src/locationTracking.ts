import type { Coordinate } from './types';
/** Camera ownership is explicit; rerenders must not undo gesture interruption. */
export function createLocationFollowState() {
  let enabled = false,
    controlled = false,
    interrupted = false;
  let latest: Coordinate | undefined;
  const target = () =>
    enabled && !controlled && !interrupted ? latest : undefined;
  return {
    configure(nextEnabled: boolean, nextControlled: boolean) {
      if (
        typeof nextEnabled !== 'boolean' ||
        typeof nextControlled !== 'boolean'
      )
        throw new TypeError('Location follow flags must be boolean');
      if (!nextEnabled || !enabled) interrupted = false;
      enabled = nextEnabled;
      controlled = nextControlled;
    },
    current: target,
    clear() {
      latest = undefined;
    },
    update(coordinate: Coordinate) {
      latest = { ...coordinate };
      return target();
    },
    gesture() {
      if (enabled) interrupted = true;
    },
    resume() {
      interrupted = false;
      return target();
    },
  };
}
