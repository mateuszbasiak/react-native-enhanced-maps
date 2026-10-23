import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const arch = process.argv[2] ?? 'arm64';
assert(['arm64', 'x86_64'].includes(arch), 'Expected arm64 or x86_64');
for (const variant of ['Debug', 'Release']) {
  const object = path.join(
    'example/ios/build/DerivedData/Build/Intermediates.noindex/Pods.build',
    `${variant}-iphonesimulator/EnhancedMaps.build/Objects-normal`,
    arch,
    'EMMapLibreView.o',
  );
  const symbols = execFileSync('nm', [object], { encoding: 'utf8' });
  for (const method of ['diagnostics', 'stats:resolver:rejecter:'])
    assert.equal(
      symbols.includes(`-[EMShaderLayerModule ${method}]`),
      variant === 'Debug',
      `${variant}: unexpected ${method} state`,
    );
  for (const method of [
    'install',
    'create:resolver:rejecter:',
    'release:resolver:rejecter:',
  ])
    assert(
      symbols.includes(`-[EMShaderLayerModule ${method}]`),
      `${variant}: missing ${method}`,
    );
  const exports = [
    ...symbols.matchAll(
      /^[0-9a-f]+ [tT] \+\[EMShaderLayerModule __rct_export__[^\]]+\]/gm,
    ),
  ];
  assert.equal(
    exports.length,
    variant === 'Debug' ? 5 : 3,
    `${variant}: unexpected bridge metadata count`,
  );
  console.log(
    `${variant}: shader transport present; development counters ${variant === 'Debug' ? 'present' : 'absent'}`,
  );
}
