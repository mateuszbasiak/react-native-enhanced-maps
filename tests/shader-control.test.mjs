import assert from 'node:assert/strict';
import { test } from 'node:test';

test('control patches retain original worklet callbacks without reading a serialized copy', async () => {
  const { createShaderControlChannel } =
    await import('../packages/maps/lib/shaderControl.js');
  const uniforms = () => [1];
  const initial = {
    stopped: false,
    active: true,
    paused: false,
    uniforms,
    gridVersion: 0,
  };
  const packets = [];
  const channel = createShaderControlChannel(initial, () => ({
    getBlocking() {
      throw new Error('Rehydrating a worklet here loses its callable identity');
    },
    setBlocking(packet) {
      packets.push(packet);
    },
  }));
  channel.update({ paused: true });
  channel.update((previous) => ({ gridVersion: previous.gridVersion + 1 }));
  channel.update({ active: false });
  assert.ok(packets.every((packet) => packet.uniforms === uniforms));
  assert.equal(packets.at(-1).gridVersion, 1);
  assert.equal(packets.at(-1).paused, true);
  assert.equal(packets.at(-1).active, false);
  const replacement = () => [2];
  channel.update({ uniforms: replacement });
  channel.update({ stopped: true });
  assert.equal(packets.at(-1).uniforms, replacement);
  assert.equal(packets.at(-1).stopped, true);
});
