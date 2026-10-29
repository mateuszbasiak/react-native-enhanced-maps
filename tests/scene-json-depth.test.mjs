import { test } from 'node:test';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
const output = path.resolve('artifacts/native-tests/json-depth');
mkdirSync(output, { recursive: true });
const nested = (depth) => '{"a":'.repeat(depth) + '0' + '}'.repeat(depth);
const fixtures = [
  ['', true],
  ['0', true],
  ['{}', true],
  [nested(64), true],
  [nested(65), false],
  [nested(100000), false],
  ['['.repeat(64) + '0' + ']'.repeat(64), true],
  ['['.repeat(65) + '0' + ']'.repeat(65), false],
  ['[{"a":'.repeat(32) + '0' + '}]'.repeat(32), true],
  ['[{"a":'.repeat(33) + '0' + '}]'.repeat(33), false],
  [JSON.stringify({ text: '{}[]'.repeat(100000) }), true],
  [JSON.stringify({ text: 'Unicode 水 " { [ } ] \\ end' }), true],
  ['{"text":' + JSON.stringify('\\') + ',"next":' + nested(64) + '}', false],
  [
    '{"text":' + JSON.stringify('\\"{[\\') + ',"next":' + nested(63) + '}',
    true,
  ],
  ['[' + '0,'.repeat(100000) + '0]', true],
];
const deepArray = '['.repeat(1000) + '0' + ']'.repeat(1000);
for (const prefix of [
  `{"x":'"',"y":`,
  '{"x":foo"bar,"y":',
  '{"x":/* " */0,"y":',
  '{"x":// "\n0,"y":',
  '{"x":# "\n0,"y":',
])
  fixtures.push([prefix + deepArray + '}', false]);
for (const input of ['true', 'false', 'null', '-12.3e+4', '0', '[1,-2.5,3e-2]'])
  fixtures.push([input, true]);
for (const input of [
  'undefined',
  'NaN',
  '+1',
  '01',
  '1.',
  '1e',
  'true"suffix',
  "'value'",
])
  fixtures.push([input, false]);
fixtures.push([JSON.stringify({ text: 'O\'Reilly /* // # foo"bar' }), true]);
let properties = 0;
for (let i = 0; i < 16; i++) properties = { a: properties };
fixtures.push([
  JSON.stringify({
    sources: [
      {
        id: 'nested',
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              id: 'point',
              properties,
              geometry: { type: 'Point', coordinates: [18, 54] },
            },
          ],
        },
      },
    ],
    layers: [],
  }),
  true,
]);
const u32 = (n) => {
  const b = Buffer.alloc(4);
  b.writeUInt32BE(n);
  return b;
};
const corpus = path.join(output, 'corpus.bin');
writeFileSync(
  corpus,
  Buffer.concat([
    u32(fixtures.length),
    ...fixtures.flatMap(([input, expected]) => {
      const bytes = Buffer.from(input);
      return [u32(bytes.length), Buffer.from([+expected]), bytes];
    }),
  ]),
);
test('Java scene depth scan bounds containers before parsing without counting strings', () => {
  execFileSync('javac', [
    '-d',
    output,
    'packages/maps/android/src/main/java/com/enhancedmaps/SceneJSONDepth.java',
    'tests/native/SceneJSONDepthTest.java',
  ]);
  execFileSync('java', ['-cp', output, 'SceneJSONDepthTest', corpus]);
});
test('C++ scene depth scan agrees with Java on the shared UTF-8 corpus', () => {
  const binary = path.join(output, 'scene-depth');
  execFileSync('c++', [
    '-std=c++17',
    '-Wall',
    '-Wextra',
    '-Werror',
    'tests/native/SceneJSONDepthTest.cpp',
    '-o',
    binary,
  ]);
  execFileSync(binary, [corpus]);
});
