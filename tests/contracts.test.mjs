import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  validateCamera,
  createRevisionGate,
} from '../packages/maps/lib/contracts.js';

test('invalid camera coordinates cannot enter the native boundary', () => {
  const valid = {
    center: { latitude: 52, longitude: 21 },
    zoom: 10,
    heading: 0,
    pitch: 0,
  };
  assert.equal(validateCamera(valid), valid);
  for (const value of [NaN, Infinity, -Infinity]) {
    assert.throws(() => validateCamera({ ...valid, zoom: value }), /finite/);
  }
  assert.throws(
    () => validateCamera({ ...valid, center: { latitude: 91, longitude: 0 } }),
    /latitude/,
  );
  assert.throws(() => validateCamera({ ...valid, pitch: -1 }), /pitch/);
});

test('late native jobs cannot apply after replacement or disposal', () => {
  const gate = createRevisionGate();
  const first = gate.advance();
  assert.equal(gate.isCurrent(first), true);
  const second = gate.advance();
  assert.equal(gate.isCurrent(first), false);
  assert.equal(gate.isCurrent(second), true);
  gate.dispose();
  gate.dispose();
  assert.equal(gate.isCurrent(second), false);
  assert.throws(() => gate.advance(), /disposed/);
});

test('camera bounds reject invalid source values before SDK calls', () => {
  const camera = {
    center: { latitude: 0, longitude: 0 },
    zoom: 3,
    heading: 0,
    pitch: 0,
  };
  assert.throws(
    () =>
      validateCamera({ ...camera, center: { latitude: 0, longitude: 181 } }),
    /longitude/,
  );
  assert.throws(() => validateCamera({ ...camera, zoom: -1 }), /zoom/);
  assert.throws(() => validateCamera({ ...camera, pitch: 91 }), /pitch/);
  assert.throws(() => validateCamera({ ...camera, heading: NaN }), /finite/);
});

test('recoverable tile loading errors do not invalidate map command readiness', async () => {
  const { classifyMapError } =
    await import('../packages/maps/lib/contracts.js');
  assert.equal(
    typeof classifyMapError,
    'function',
    'Native error classification is required',
  );
  assert.equal(
    classifyMapError({ code: 'map-load', message: 'temporary network failure' })
      .fatal,
    false,
  );
  assert.equal(
    classifyMapError({
      code: 'missing-api-key',
      message: 'missing configuration',
    }).fatal,
    true,
  );
  assert.equal(
    classifyMapError({ code: 'unknown-error', message: 'unexpected failure' })
      .fatal,
    true,
  );
});

test('invalid viewport padding remains recoverable for map commands', async () => {
  const { classifyMapError } =
    await import('../packages/maps/lib/contracts.js');
  assert.equal(
    classifyMapError({
      code: 'invalid-map-padding',
      message: 'viewport too small',
    }).fatal,
    false,
  );
});

test('both native style loading error codes are recoverable', async () => {
  const { classifyMapError } =
    await import('../packages/maps/lib/contracts.js');
  for (const code of ['style-load', 'map-load'])
    assert.equal(
      classifyMapError({ code, message: 'network unavailable' }).fatal,
      false,
    );
});
