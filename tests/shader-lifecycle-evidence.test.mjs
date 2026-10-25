import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const source = readFileSync(
  new URL('../example/gpu/shaderLifecycleEvidence.ts', import.meta.url),
  'utf8',
);
const { verifyShaderClock, shaderMapReady } = await import(
  'data:text/javascript;base64,' +
    Buffer.from(
      ts.transpileModule(source, {
        compilerOptions: {
          module: ts.ModuleKind.ESNext,
          target: ts.ScriptTarget.ES2022,
        },
      }).outputText,
    ).toString('base64')
);
const frame = { epoch: 2, frames: 10, time: 1, delta: 0.016 };
test('running requires fresh frames and simulation progress in the same epoch', () => {
  assert.equal(
    verifyShaderClock(frame, { ...frame, frames: 12, time: 1.032 }, 'running')
      .pass,
    true,
  );
  assert.equal(
    verifyShaderClock(frame, { ...frame, frames: 12 }, 'running').pass,
    false,
  );
  assert.equal(
    verifyShaderClock(frame, { ...frame, time: 2 }, 'running').pass,
    false,
  );
});
test('pause freezes simulation while continuing to encode frames', () => {
  const paused = { ...frame, delta: 0 };
  assert.equal(
    verifyShaderClock(paused, { ...paused, frames: 12 }, 'paused').pass,
    true,
  );
  assert.equal(verifyShaderClock(paused, paused, 'paused').pass, false);
  assert.equal(
    verifyShaderClock(paused, { ...paused, frames: 12, time: 1.01 }, 'paused')
      .pass,
    false,
  );
  assert.equal(
    verifyShaderClock(paused, { ...paused, frames: 12, delta: 0.01 }, 'paused')
      .pass,
    false,
  );
});
test('background clock observation requires no new production or simulation progress', () => {
  assert.equal(verifyShaderClock(frame, frame, 'background').pass, true);
  assert.equal(
    verifyShaderClock(frame, { ...frame, frames: 11 }, 'background').pass,
    false,
  );
  assert.equal(
    verifyShaderClock(frame, { ...frame, time: 2 }, 'background').pass,
    false,
  );
});
test('stale epochs, uninitialized probes and invalid frame clocks cannot pass', () => {
  assert.equal(
    verifyShaderClock(
      frame,
      { ...frame, epoch: 3, frames: 11, time: 2 },
      'running',
    ).pass,
    false,
  );
  for (const invalid of [
    null,
    { ...frame, frames: 0 },
    { ...frame, frames: 1.5 },
    { ...frame, time: NaN },
    { ...frame, delta: 0.2 },
    { ...frame, epoch: -1 },
  ])
    assert.equal(verifyShaderClock(invalid, invalid, 'background').pass, false);
  assert.equal(
    verifyShaderClock(frame, { ...frame, frames: 9 }, 'background').pass,
    false,
  );
});

test('map readiness requires the current native style and mount as well as shader epoch', () => {
  const value = {
    mounted: true,
    epoch: 2,
    mount: 3,
    alternateStyle: true,
    readyEpoch: 2,
    mapReadyMount: 3,
    mapReadyStyle: true,
    probe: frame,
  };
  assert.equal(shaderMapReady(value), true);
  for (const patch of [
    { mounted: false },
    { readyEpoch: 1 },
    { mapReadyMount: 2 },
    { mapReadyStyle: false },
    { probe: { ...frame, epoch: 1 } },
    { probe: { ...frame, frames: 0 } },
  ])
    assert.equal(shaderMapReady({ ...value, ...patch }), false);
});
