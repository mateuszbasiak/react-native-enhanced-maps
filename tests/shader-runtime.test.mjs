import assert from 'node:assert/strict';
import test from 'node:test';
import { createShaderRuntimeCache } from '../packages/maps/lib/shaderRuntime.js';
test('repeated shader lifetimes retain one worker instead of creating native runtimes per initialization', () => {
  const runtimeFor = createShaderRuntimeCache();
  let creates = 0;
  const runtime = { name: 'shader-worker' };
  for (let i = 0; i < 100; i++)
    assert.equal(
      runtimeFor(() => {
        creates++;
        return runtime;
      }),
      runtime,
    );
  assert.equal(creates, 1);
});
test('independent layer factories share the worker while their caller-owned state remains separate', () => {
  const runtimeFor = createShaderRuntimeCache();
  const first = { owner: 'worker' };
  assert.equal(
    runtimeFor(() => first),
    first,
  );
  assert.equal(
    runtimeFor(() => assert.fail('second worker allocation')),
    first,
  );
});
test('a failed worker factory is not cached and a later initialization may retry', () => {
  const runtimeFor = createShaderRuntimeCache();
  assert.throws(
    () =>
      runtimeFor(() => {
        throw new Error('worker unavailable');
      }),
    /worker unavailable/,
  );
  const runtime = {};
  assert.equal(
    runtimeFor(() => runtime),
    runtime,
  );
});
