import type {
  Capability,
  LayerKind,
  MapCapabilities,
  MapPlatform,
} from './types';
const kinds: readonly LayerKind[] = [
  'circle',
  'symbol',
  'line',
  'fill',
  'raster',
  'heatmap',
];
const states: readonly Capability[] = [
  'supported',
  'unsupported',
  'unvalidated',
];
const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

/** Validate a view-owned native report; never infer support from a provider name. */
export function parseCapabilities(
  json: string,
  platform: MapPlatform,
): MapCapabilities {
  const invalid = () => new Error('Invalid native map capabilities');
  if (json.length > 4096) throw invalid();
  let report: unknown;
  try {
    report = JSON.parse(json);
  } catch {
    throw invalid();
  }
  if (!object(report)) throw invalid();
  const layers = report.layers;
  if (
    report.engine !== 'maplibre' ||
    report.platform !== platform ||
    Object.keys(report).some(
      (key) =>
        ![
          'engine',
          'platform',
          'layers',
          'shaders',
          'detailedGestures',
        ].includes(key),
    ) ||
    !object(layers) ||
    Object.keys(layers).length !== kinds.length ||
    !kinds.every((kind) =>
      states.includes((layers as Record<string, unknown>)[kind] as Capability),
    ) ||
    !states.includes(report.shaders as Capability) ||
    !states.includes(report.detailedGestures as Capability)
  )
    throw invalid();
  return Object.freeze({
    engine: 'maplibre',
    platform,
    layers: Object.freeze({ ...layers }) as Readonly<
      Record<LayerKind, Capability>
    >,
    shaders: report.shaders as Capability,
    detailedGestures: report.detailedGestures as Capability,
  });
}

/** View-local readiness state; queued events cannot revive obsolete style requests. */
export function createMapReadiness(platform: MapPlatform) {
  let active = false;
  let request = 0;
  let failed = false;
  let capabilities: MapCapabilities | null = null;
  let generation = 0;
  return {
    activate(styleRequest: number) {
      if (!active || request !== styleRequest) {
        capabilities = null;
        failed = false;
        generation++;
      }
      request = styleRequest;
      active = true;
    },
    deactivate() {
      active = false;
      capabilities = null;
      generation++;
    },
    beginReload(styleRequest: number) {
      if (!active || request !== styleRequest) return false;
      failed = true;
      capabilities = null;
      generation++;
      return true;
    },
    acceptLoadFailure(styleRequest: number) {
      if (!active || request !== styleRequest || capabilities !== null)
        return false;
      failed = true;
      generation++;
      return true;
    },
    invalidate() {
      capabilities = null;
      generation++;
    },
    acceptReport(styleRequest: number, json: string): MapCapabilities | null {
      if (!active || failed || styleRequest !== request) return null;
      capabilities = parseCapabilities(json, platform);
      generation++;
      return capabilities;
    },
    getGeneration() {
      return generation;
    },
    isReady(styleRequest: number) {
      return active && request === styleRequest && capabilities !== null;
    },
    getCapabilities() {
      return active ? capabilities : null;
    },
  };
}
