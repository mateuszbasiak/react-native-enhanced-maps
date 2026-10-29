import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkAndroidPageSize } from '../scripts/check-android-page-size.mjs';
function elf({
  alignment = 16384n,
  relroEnd = 32768n,
  fileOffset = 0n,
  machine = 183,
} = {}) {
  const b = Buffer.alloc(64 + 2 * 56);
  b.set([0x7f, 0x45, 0x4c, 0x46, 2, 1]);
  b.writeUInt16LE(machine, 18);
  b.writeBigUInt64LE(64n, 32);
  b.writeUInt16LE(56, 54);
  b.writeUInt16LE(2, 56);
  b.writeUInt32LE(1, 64);
  b.writeBigUInt64LE(fileOffset, 72);
  b.writeBigUInt64LE(16384n, 80);
  b.writeBigUInt64LE(alignment, 112);
  b.writeUInt32LE(0x6474e552, 120);
  b.writeBigUInt64LE(20000n, 136);
  b.writeBigUInt64LE(relroEnd - 20000n, 160);
  return b;
}
test('ELF artifact check accepts aligned arm64 and x86_64 LOAD and RELRO segments', () => {
  for (const machine of [183, 62])
    assert.deepEqual(checkAndroidPageSize(elf({ machine })), {
      loadAlignments: [16384],
      relroEnds: ['0x8000'],
    });
});
test('ELF artifact check rejects 4 KB loads, partial RELRO pages and incongruent addresses', () => {
  for (const options of [
    { alignment: 4096n },
    { alignment: 24576n },
    { relroEnd: 28672n },
    { fileOffset: 4096n },
  ])
    assert.throws(() => checkAndroidPageSize(elf(options)));
});
test('ELF artifact check fails closed on unsupported or truncated input', () => {
  for (const bytes of [
    Buffer.alloc(1),
    Buffer.alloc(64),
    elf({ machine: 40 }),
    elf().subarray(0, 100),
  ])
    assert.throws(() => checkAndroidPageSize(bytes));
  const noLoads = elf();
  noLoads.writeUInt32LE(0, 64);
  assert.throws(() => checkAndroidPageSize(noLoads), /no LOAD/);
});
