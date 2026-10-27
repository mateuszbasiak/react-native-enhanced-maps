import type { MarkerLayout } from './markerClustering';
export interface MarkerLayoutEnvelope {
  readonly styleRevision: number;
  readonly layout: MarkerLayout;
}
/** A render-phase version update is pending until both signature and revision match. */
export function currentMarkerLayout(
  accepted: MarkerLayoutEnvelope | undefined,
  styleRevision: number,
  version: Readonly<{ signature: string; revision: number }>,
  signature: string,
): MarkerLayout | undefined {
  if (
    accepted?.styleRevision !== styleRevision ||
    version.signature !== signature ||
    accepted.layout.sourceRevision !== version.revision
  )
    return;
  return accepted.layout;
}
