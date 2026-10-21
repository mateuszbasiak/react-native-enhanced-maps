import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
const sample = () => ({
  kind: 'zoom',
  phase: 'begin',
  id: 1,
  timestampMs: 10,
  x: 25,
  y: 50,
});
test('gesture interval and typed event parsing reject malformed native data', async () => {
  const { validateGestureInterval, parseNativeGesture } =
    await import('../packages/maps/lib/gestures.js');
  assert.equal(validateGestureInterval(undefined), 50);
  for (const value of [16, 50, 1000])
    assert.equal(validateGestureInterval(value), value);
  for (const value of [0, 15, 1001, NaN, Infinity, -1])
    assert.throws(() => validateGestureInterval(value), RangeError);
  assert.deepEqual(parseNativeGesture(sample()), {
    kind: 'zoom',
    phase: 'begin',
    id: 1,
    timestampMs: 10,
    position: { x: 25, y: 50 },
  });
  for (const kind of ['pan', 'zoom', 'rotate', 'tilt'])
    for (const phase of ['begin', 'update', 'end', 'cancel'])
      assert.equal(
        parseNativeGesture({ ...sample(), kind, phase }).phase,
        phase,
      );
  for (const patch of [
    { kind: 'other' },
    { phase: 'idle' },
    { id: 0 },
    { id: 0.5 },
    { id: Number.MAX_SAFE_INTEGER + 1 },
    { timestampMs: -1 },
    { timestampMs: Infinity },
    { x: NaN },
    { y: null },
  ])
    assert.equal(parseNativeGesture({ ...sample(), ...patch }), null);
  for (const value of [null, {}, [], undefined])
    assert.equal(parseNativeGesture(value), null);
});
test('native gesture gates bound updates while retaining lifecycle and simultaneous kinds', () => {
  const output = path.resolve('artifacts/native-tests');
  mkdirSync(output, { recursive: true });
  execFileSync('javac', [
    '-d',
    output,
    'packages/maps/android/src/main/java/com/enhancedmaps/GestureEventGate.java',
    'tests/native/GestureEventGateTest.java',
  ]);
  assert.doesNotThrow(() =>
    execFileSync('java', ['-cp', output, 'GestureEventGateTest']),
  );
  const binary = path.join(output, 'gesture-event-gate');
  execFileSync('c++', [
    '-std=c++17',
    '-Ipackages/maps/ios',
    'tests/native/GestureEventGateTest.cpp',
    '-o',
    binary,
  ]);
  assert.doesNotThrow(() => execFileSync(binary));
});
