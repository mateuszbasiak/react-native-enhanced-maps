import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

// RN discovers declared methods on the concrete module class, not a plain base.
// Build both Kotlin variants before running this native verification command.
const javap = process.env.JAVA_HOME
  ? path.join(process.env.JAVA_HOME, 'bin/javap')
  : 'javap';
for (const variant of ['debug', 'release']) {
  const declarations = execFileSync(
    javap,
    [
      '-v',
      '-classpath',
      `packages/maps/android/build/tmp/kotlin-classes/${variant}`,
      'com.enhancedmaps.ShaderLayerModule',
    ],
    { encoding: 'utf8' },
  );
  const methods = new Map(
    [
      ...declarations.matchAll(
        /^ {2}public [^\n]* (\w+)\([^;\n]*\);([\s\S]*?)(?=^ {2}(?:public|protected|private) |^})/gm,
      ),
    ]
      .filter(([, , body]) =>
        body.includes('com.facebook.react.bridge.ReactMethod'),
      )
      .map(([, name, body]) => [name, body]),
  );
  const transport = ['install', 'create', 'acquire', 'publish', 'release'];
  const expected =
    variant === 'debug' ? [...transport, 'diagnostics', 'stats'] : transport;
  assert.deepEqual(
    [...methods.keys()].sort(),
    expected.sort(),
    `${variant}: unexpected bridge exports`,
  );
  assert(
    methods.get('install').includes('isBlockingSynchronousMethod=true'),
    `${variant}: install must remain synchronous`,
  );
  console.log(
    `${variant}: shader transport present; development counters ${variant === 'debug' ? 'present' : 'absent'}`,
  );
}
