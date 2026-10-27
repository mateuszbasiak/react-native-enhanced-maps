import type { Coordinate } from './types';
export type MarkerDragPhase = 'start' | 'update' | 'end' | 'cancel';
interface DragSample {
  readonly phase: MarkerDragPhase;
  readonly coordinate: Coordinate;
}
/** Native sessions prevent queued events from a disabled/replaced drag changing JS state. */
export function createMarkerDragGate() {
  let lastSession = 0;
  let previousProps: Coordinate | undefined;
  let retainedCoordinate: Coordinate | undefined;
  let active: { session: number; revision: number } | undefined;
  return {
    /** Match native ownership: unchanged props retain a successful drag endpoint. */
    syncCoordinate(coordinate: Coordinate): Coordinate {
      if (
        !previousProps ||
        coordinate.latitude !== previousProps.latitude ||
        coordinate.longitude !== previousProps.longitude
      ) {
        previousProps = { ...coordinate };
        if (!active) retainedCoordinate = { ...coordinate };
      }
      return { ...(retainedCoordinate ?? coordinate) };
    },
    accept(
      value: unknown,
      revision: number,
      enabled: boolean,
    ): DragSample | null {
      const e = value as {
        phase: MarkerDragPhase;
        session: number;
        revision: number;
        latitude: number;
        longitude: number;
      } | null;
      if (
        !e ||
        !['start', 'update', 'end', 'cancel'].includes(e.phase) ||
        !Number.isSafeInteger(e.session) ||
        e.session < 1 ||
        !Number.isSafeInteger(e.revision) ||
        ![e.latitude, e.longitude].every(Number.isFinite) ||
        Math.abs(e.latitude) > 90 ||
        Math.abs(e.longitude) > 180
      )
        return null;
      if (e.phase === 'start') {
        if (
          !enabled ||
          e.revision !== revision ||
          active ||
          e.session <= lastSession
        )
          return null;
        lastSession = e.session;
        active = { session: e.session, revision: e.revision };
      } else {
        if (
          !active ||
          active.session !== e.session ||
          active.revision !== e.revision
        )
          return null;
        if (e.phase !== 'cancel' && (!enabled || e.revision !== revision))
          return null;
        if (e.phase === 'end' || e.phase === 'cancel') active = undefined;
      }
      retainedCoordinate = { latitude: e.latitude, longitude: e.longitude };
      return {
        phase: e.phase,
        coordinate: { ...retainedCoordinate },
      };
    },
    cancel(coordinate: Coordinate): DragSample | null {
      if (!active) return null;
      active = undefined;
      retainedCoordinate = { ...coordinate };
      return { phase: 'cancel', coordinate: { ...coordinate } };
    },
  };
}
