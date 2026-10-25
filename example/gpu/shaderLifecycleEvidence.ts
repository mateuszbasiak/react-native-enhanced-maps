export interface ShaderClockProbe {
  epoch: number;
  frames: number;
  time: number;
  delta: number;
}
export type ShaderClockMode = 'running' | 'paused' | 'background';
function valid(value: unknown): value is ShaderClockProbe {
  if (!value || typeof value !== 'object') return false;
  const probe = value as ShaderClockProbe;
  return (
    Number.isInteger(probe.epoch) &&
    probe.epoch >= 0 &&
    Number.isInteger(probe.frames) &&
    probe.frames > 0 &&
    Number.isFinite(probe.time) &&
    probe.time >= 0 &&
    Number.isFinite(probe.delta) &&
    probe.delta >= 0 &&
    probe.delta <= 0.05
  );
}
/** Clock assertions only; callers also record AppState, readiness and native resources. */
export function verifyShaderClock(
  before: unknown,
  after: unknown,
  mode: ShaderClockMode,
) {
  const result = (pass: boolean, reason: string) => ({ pass, reason });
  if (!valid(before) || !valid(after))
    return result(false, 'Invalid or uninitialized frame probe');
  if (before.epoch !== after.epoch)
    return result(false, 'Shader epoch changed');
  if (after.frames < before.frames || after.time < before.time)
    return result(false, 'Frame clock moved backwards');
  if (mode === 'running')
    return result(
      after.frames > before.frames &&
        after.time > before.time &&
        after.delta > 0,
      'Running requires new frames and simulation progress',
    );
  if (mode === 'paused')
    return result(
      after.frames > before.frames &&
        after.time === before.time &&
        before.delta === 0 &&
        after.delta === 0,
      'Pause requires new frames with frozen simulation time',
    );
  if (mode === 'background')
    return result(
      after.frames === before.frames && after.time === before.time,
      'Background requires no new frames or simulation progress',
    );
  return result(false, 'Unknown clock assertion');
}

export function shaderMapReady(value: {
  mounted: boolean;
  epoch: number;
  mount: number;
  alternateStyle: boolean;
  readyEpoch: number;
  mapReadyMount: number;
  mapReadyStyle: boolean;
  probe: ShaderClockProbe;
}): boolean {
  return (
    value.mounted &&
    value.readyEpoch === value.epoch &&
    value.mapReadyMount === value.mount &&
    value.mapReadyStyle === value.alternateStyle &&
    valid(value.probe) &&
    value.probe.epoch === value.epoch
  );
}
