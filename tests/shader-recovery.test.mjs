import assert from 'node:assert/strict';
import test from 'node:test';
import {
  runShaderRecovery,
  releaseShaderResources,
} from '../packages/maps/lib/shaderRecovery.js';
test('only unexpected loss requests another attempt and retries are bounded', async () => {
  for (const losses of [0, 1, 2, 3, 10]) {
    let attempts = 0,
      exhaustions = 0;
    const waits = [];
    await runShaderRecovery({
      run: async () => ++attempts <= losses,
      stopped: () => false,
      wait: async (ms) => waits.push(ms),
      exhausted: () => exhaustions++,
    });
    assert.equal(attempts, Math.min(losses + 1, 3));
    assert.deepEqual(waits, [100, 500].slice(0, Math.min(losses, 2)));
    assert.equal(exhaustions, losses >= 3 ? 1 : 0);
  }
});
test('disposal before starting or during the retry delay prevents initialization', async () => {
  for (const before of [true, false]) {
    let stopped = before,
      attempts = 0;
    await runShaderRecovery({
      run: async () => {
        attempts++;
        return true;
      },
      stopped: () => stopped,
      wait: async () => {
        stopped = true;
      },
      exhausted: () => assert.fail('must not exhaust'),
    });
    assert.equal(attempts, before ? 0 : 1);
  }
});
test('cleanup continues after errors, preserves order and cannot be interrupted by an error callback', async () => {
  const order = [];
  const ok = await releaseShaderResources(
    [
      () => order.push('detach'),
      async () => {
        order.push('texture');
        throw new Error('destroy failed');
      },
      () => order.push('memory'),
      () => order.push('release'),
      () => order.push('device'),
    ],
    () => {
      throw new Error('application error callback');
    },
  );
  assert.equal(ok, false);
  assert.deepEqual(order, ['detach', 'texture', 'memory', 'release', 'device']);
});
test('recovery waits for complete cleanup and does not overlap attempts', async () => {
  const events = [];
  let attempts = 0;
  await runShaderRecovery({
    run: async () => {
      const attempt = ++attempts;
      events.push(`start${attempt}`);
      const clean = await releaseShaderResources(
        [
          async () => {
            await Promise.resolve();
            events.push(`release${attempt}`);
          },
        ],
        () => assert.fail(),
      );
      return attempt === 1 && clean;
    },
    stopped: () => false,
    wait: async () => events.push('wait'),
    exhausted: () => assert.fail(),
  });
  assert.deepEqual(events, [
    'start1',
    'release1',
    'wait',
    'start2',
    'release2',
  ]);
});
test('a failed cleanup prevents a requested device replacement', async () => {
  let attempts = 0;
  await runShaderRecovery({
    run: async () => {
      attempts++;
      return await releaseShaderResources(
        [
          () => {
            throw new Error('native release failed');
          },
        ],
        () => {},
      );
    },
    stopped: () => false,
    wait: async () => assert.fail(),
    exhausted: () => assert.fail(),
  });
  assert.equal(attempts, 1);
});
