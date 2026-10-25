import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { createShaderDeviceCache } from '../packages/maps/lib/shaderDevice.js';
function fixture(fallback = false) {
  const devices = [];
  let adapters = 0;
  const cache = createShaderDeviceCache(async () => {
    adapters++;
    let consumed = false;
    return {
      info: { isFallbackAdapter: fallback },
      requestDevice: async () => {
        if (consumed) throw Error('adapter is consumed');
        consumed = true;
        let resolve;
        const listeners = [];
        const device = {
          listeners,
          addEventListener(type, listener) {
            listeners.push(listener);
          },
          removeEventListener() {
            /* Native 0.17.0 intentionally does nothing. */
          },
          error(event) {
            listeners.forEach((listener) => listener(event));
          },
          lost: new Promise((r) => {
            resolve = r;
          }),
          destroy() {},
          lose(info) {
            resolve(info);
          },
        };
        devices.push(device);
        return device;
      },
    };
  });
  return { cache, devices, adapters: () => adapters };
}
test('repeated shader lifetimes reuse one native device', async () => {
  const f = fixture();
  for (let i = 0; i < 100; i++) {
    const lease = await f.cache.acquire(false, () => {});
    assert.equal(lease.device, f.devices[0]);
    lease.release();
  }
  assert.equal(f.adapters(), 1);
  assert.equal(f.devices.length, 1);
});
test('active layers have exclusive devices; released devices are reused', async () => {
  const f = fixture();
  const first = await f.cache.acquire(false, () =>
    assert.fail('first was released'),
  );
  const second = await f.cache.acquire(false, () => {});
  assert.notEqual(first.device, second.device);
  first.release();
  const third = await f.cache.acquire(false, () => {});
  assert.equal(third.device, first.device);
  first.release(); // An old lease cannot return a device currently borrowed again.
  const fourth = await f.cache.acquire(false, () => {});
  assert.notEqual(fourth.device, third.device);
});
test('software consent is checked for every consumer, before device creation', async () => {
  const f = fixture(true);
  await assert.rejects(
    f.cache.acquire(false, () => {}),
    /Software GPU/,
  );
  assert.equal(f.devices.length, 0);
  const allowed = await f.cache.acquire(true, () => {});
  await assert.rejects(
    f.cache.acquire(false, () => {}),
    /Software GPU/,
  );
  assert.equal(f.devices.length, 1);
  allowed.release();
});
test('loss only affects the owner and the failed device is never reused', async () => {
  const f = fixture();
  const seen = [];
  const first = await f.cache.acquire(false, () => seen.push('first'));
  const second = await f.cache.acquire(false, () => seen.push('second'));
  first.invalidate({ reason: 'unknown', message: 'removed' });
  first.release();
  assert.deepEqual(seen, ['first']);
  const third = await f.cache.acquire(false, () => {});
  assert.notEqual(third.device, first.device);
  assert.notEqual(third.device, second.device);
  second.release();
  f.devices[1].lose({ reason: 'unknown', message: 'idle loss' });
  await Promise.resolve();
  assert.deepEqual(seen, ['first']);
  const fourth = await f.cache.acquire(false, () => {});
  assert.notEqual(fourth.device, second.device);
});
test('a rejected device allocation can be retried by a later initialization', async () => {
  let attempts = 0;
  const cache = createShaderDeviceCache(async () => ({
    info: { isFallbackAdapter: false },
    requestDevice: async () => {
      if (++attempts === 1) throw Error('allocation failed');
      return {
        lost: new Promise(() => {}),
        addEventListener() {},
        destroy() {},
      };
    },
  }));
  await assert.rejects(
    cache.acquire(false, () => {}),
    /allocation failed/,
  );
  await cache.acquire(false, () => {});
  assert.equal(attempts, 2);
});
test('idle devices retain their own software policy after the adapter changes', async () => {
  let fallback = true;
  const cache = createShaderDeviceCache(async () => ({
    info: { isFallbackAdapter: fallback },
    requestDevice: async () => ({
      lost: new Promise(() => {}),
      addEventListener() {},
      destroy() {},
    }),
  }));
  const software = await cache.acquire(true, () => {});
  const failed = await cache.acquire(true, () => {});
  software.release();
  failed.invalidate({ reason: 'unknown', message: 'removed' });
  fallback = false;
  const hardware = await cache.acquire(false, () => {});
  assert.notEqual(hardware.device, software.device);
});

test('one native error dispatcher serves only the current lease despite no-op listener removal', async () => {
  const f = fixture();
  const seen = [];
  for (let i = 0; i < 100; i++) {
    const lease = await f.cache.acquire(
      false,
      () => {},
      (event) => seen.push([i, event.error.message]),
    );
    lease.device.error({ error: { message: 'active' } });
    lease.release();
    lease.device.error({ error: { message: 'idle' } });
  }
  assert.equal(f.devices[0].listeners.length, 1);
  assert.equal(seen.length, 100);
  assert.deepEqual(seen.at(-1), [99, 'active']);
});

test('a native error listener cannot root a lost device through its dispatcher', () => {
  const moduleURL = new URL(
    '../packages/maps/lib/shaderDevice.js',
    import.meta.url,
  ).href;
  const child = spawnSync(
    process.execPath,
    [
      '--expose-gc',
      '--input-type=module',
      '--eval',
      `
    import assert from 'node:assert/strict';
    import { createShaderDeviceCache } from ${JSON.stringify(moduleURL)};
    const nativeListeners=[];
    const cache=createShaderDeviceCache(async()=>({
      info:{isFallbackAdapter:false},
      requestDevice:async()=>({lost:new Promise(()=>{}),addEventListener(type,listener){nativeListeners.push(listener);}})
    }));
    let weak;
    async function lifetime(){
      const lease=await cache.acquire(false,()=>{},()=>{});
      weak=new WeakRef(lease.device);
      lease.invalidate({reason:'unknown',message:'lost'});
      lease.release();
    }
    await lifetime();
    for(let i=0;i<10;i++){
      await new Promise(resolve=>setImmediate(resolve));
      globalThis.gc();
    }
    assert.equal(nativeListeners.length,1);
    assert.equal(weak.deref(),undefined,'native error dispatcher retains the invalidated device');
  `,
    ],
    { encoding: 'utf8' },
  );
  assert.equal(child.status, 0, child.stderr || child.stdout);
});
