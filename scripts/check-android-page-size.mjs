import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Check Android ELF64 LOAD and RELRO invariants independently of build flags. */
export function checkAndroidPageSize(bytes) {
  const check = (condition, message) => {
    if (!condition) throw Error(message);
  };
  check(Buffer.isBuffer(bytes) && bytes.length >= 64, 'Truncated ELF header');
  check(
    bytes.subarray(0, 4).equals(Buffer.from([0x7f, 0x45, 0x4c, 0x46])) &&
      bytes[4] === 2 &&
      bytes[5] === 1,
    'Expected little-endian ELF64',
  );
  check(
    [62, 183].includes(bytes.readUInt16LE(18)),
    'Expected Android x86_64 or arm64 ELF',
  );
  const start = bytes.readBigUInt64LE(32),
    size = bytes.readUInt16LE(54),
    count = bytes.readUInt16LE(56);
  check(
    size >= 56 &&
      count > 0 &&
      start + BigInt(size) * BigInt(count) <= BigInt(bytes.length),
    'Invalid ELF program header table',
  );
  const page = 16384n,
    loads = [],
    relro = [];
  for (let index = 0; index < count; index++) {
    const offset = Number(start) + index * size,
      type = bytes.readUInt32LE(offset);
    const fileOffset = bytes.readBigUInt64LE(offset + 8),
      address = bytes.readBigUInt64LE(offset + 16),
      memorySize = bytes.readBigUInt64LE(offset + 40),
      alignment = bytes.readBigUInt64LE(offset + 48);
    if (type === 1) {
      check(
        alignment >= page && (alignment & (alignment - 1n)) === 0n,
        'LOAD segment alignment is below 16 KB or invalid',
      );
      check(
        fileOffset % page === address % page,
        'LOAD file/virtual offsets are not congruent at 16 KB',
      );
      loads.push(Number(alignment));
    }
    if (type === 0x6474e552) {
      check(
        (address + memorySize) % page === 0n,
        'RELRO end is not aligned to 16 KB',
      );
      relro.push('0x' + (address + memorySize).toString(16));
    }
  }
  check(loads.length > 0, 'ELF has no LOAD segments');
  return { loadAlignments: loads, relroEnds: relro };
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const files = process.argv.slice(2);
  if (!files.length)
    throw Error(
      'Usage: node scripts/check-android-page-size.mjs <ELF64.so> [...]',
    );
  for (const file of files)
    console.log(
      JSON.stringify({ file, ...checkAndroidPageSize(readFileSync(file)) }),
    );
}
