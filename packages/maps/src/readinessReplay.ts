import type { createMapReadiness } from './capabilities';
import type { MapCapabilities } from './types';
type Callbacks = {
  probe: (styleRevision: number) => Promise<string>;
  pause: () => void;
  recovered: (report: MapCapabilities) => void;
  invalid: () => void;
};
/** Effect lifetime, separate from native style lifetime. Never retains a report. */
export function createReadinessReplay(
  readiness: ReturnType<typeof createMapReadiness>,
) {
  let resumeStyle: number | null = null;
  let activation = 0;
  return {
    activate(styleRevision: number, callbacks: Callbacks) {
      const owner = ++activation;
      let recovering = resumeStyle === styleRevision;
      resumeStyle = null;
      readiness.activate(styleRevision);
      const generation = readiness.getGeneration();
      const current = () =>
        activation === owner && readiness.getGeneration() === generation;
      if (recovering) {
        callbacks.pause();
        const failed = () => {
          recovering = false;
        };
        try {
          void callbacks.probe(styleRevision).then((json) => {
            recovering = false;
            if (!current()) return;
            let report: MapCapabilities | null;
            try {
              report = readiness.acceptReport(styleRevision, json);
            } catch {
              readiness.beginReload(styleRevision);
              callbacks.invalid();
              return;
            }
            if (report) callbacks.recovered(report);
          }, failed);
        } catch {
          failed();
        }
      }
      return () => {
        if (activation !== owner) return;
        resumeStyle =
          readiness.isReady(styleRevision) || (recovering && current())
            ? styleRevision
            : null;
        activation++;
        readiness.deactivate();
      };
    },
  };
}
