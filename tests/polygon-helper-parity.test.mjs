import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const rectangle = (west, south, east, north) => [
  [west, south],
  [east, south],
  [east, north],
  [west, north],
  [west, south],
];
const cases = [];
function add(label, point, rings, expected) {
  cases.push({ label, point, rings, expected });
}
for (const [name, west, south, east, north] of [
  ['local', -5, -5, 5, 5],
  ['dateline', 170, -10, 190, 10],
  ['north', 10, 80, 30, 85],
  ['south', -30, -85, -10, -80],
]) {
  const cx = (west + east) / 2,
    cy = (south + north) / 2;
  const hx = (east - west) / 10,
    hy = (north - south) / 10;
  const outer = rectangle(west, south, east, north);
  const hole = rectangle(cx - hx, cy - hy, cx + hx, cy + hy);
  for (const reverseOuter of [false, true]) {
    for (const reverseHole of [false, true]) {
      for (const world of [-2, -1, 0, 1, 2]) {
        const rings = [
          reverseOuter ? outer.toReversed() : outer,
          reverseHole ? hole.toReversed() : hole,
        ];
        for (const [kind, x, y, expected] of [
          ['fill', cx + 3 * hx, cy, true],
          ['hole', cx, cy, false],
          ['outer edge', west, cy, true],
          ['outer corner', west, south, true],
          ['hole edge', cx + hx, cy, false],
          ['hole corner', cx + hx, cy + hy, false],
          ['outside longitude', east + hx, cy, false],
          ['outside latitude', cx, north + hy, false],
        ])
          add(
            `${name}/${reverseOuter}/${reverseHole}/world${world}/${kind}`,
            [x + 360 * world, y],
            rings,
            expected,
          );
      }
    }
  }
}
// Independent axis-aligned membership oracle; no ray-casting/Mercator helper logic
// is copied into the expected-value calculation. All generated latitudes < 85°.
let seed = 0x5eeda11;
function random() {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 2 ** 32;
}
for (let i = 0; i < 512; i++) {
  const west = -170 + random() * 320,
    south = -70 + random() * 130;
  const width = 1 + random() * 15,
    height = 1 + random() * 10;
  const east = west + width,
    north = south + height;
  const hole = [
    west + width / 3,
    south + height / 3,
    west + (2 * width) / 3,
    south + (2 * height) / 3,
  ];
  const x = west - width / 2 + random() * 2 * width,
    y = south - height / 2 + random() * 2 * height;
  const inside = x >= west && x <= east && y >= south && y <= north;
  const inHole = x >= hole[0] && x <= hole[2] && y >= hole[1] && y <= hole[3];
  const shift = 360 * ((i % 5) - 2);
  let rings = [rectangle(west, south, east, north), rectangle(...hole)];
  if (i % 2) rings = rings.map((ring) => ring.toReversed());
  add(`seeded-${i}`, [x + shift, y], rings, inside && !inHole);
}
const outer = rectangle(-5, -5, 5, 5);
for (const [label, point, rings] of [
  ['NaN query', [NaN, 0], [outer]],
  ['infinite longitude', [Infinity, 0], [outer]],
  ['infinite latitude', [0, -Infinity], [outer]],
  ['latitude beyond pole', [0, 90.01], [outer]],
  ['empty polygon', [0, 0], []],
  [
    'short ring',
    [0, 0],
    [
      [
        [0, 0],
        [1, 0],
        [0, 0],
      ],
    ],
  ],
  ['open exterior', [0, 0], [outer.slice(0, -1)]],
  ['open hole', [3, 0], [outer, rectangle(-1, -1, 1, 1).slice(0, -1)]],
  [
    'invalid hole poisons otherwise filled hit',
    [3, 0],
    [
      outer,
      [
        [0, 0],
        [1, 0],
        [NaN, 1],
        [0, 0],
      ],
    ],
  ],
  ['invalid latitude vertex', [0, 0], [rectangle(-5, -91, 5, 5)]],
  [
    'nonfinite vertex',
    [0, 0],
    [
      [
        [0, 0],
        [Infinity, 0],
        [1, 1],
        [0, 0],
      ],
    ],
  ],
  ['unbounded world span', [0, 0], [rectangle(-1e9, -5, 1e9, 5)]],
])
  add(label, point, rings, false);

const output = path.resolve('artifacts/native-tests/polygon-parity');
mkdirSync(output, { recursive: true });
const binary = path.join(output, 'polygon-hit-parity');
test(`production C++ and Java polygon helpers match ${cases.length} shared geographic fixtures`, () => {
  execFileSync(
    'c++',
    [
      '-std=c++17',
      '-Ipackages/maps/ios',
      'tests/native/PolygonHitParity.cpp',
      '-o',
      binary,
    ],
    { stdio: 'pipe' },
  );
  execFileSync(
    'javac',
    [
      '-d',
      output,
      'packages/maps/android/src/main/java/com/enhancedmaps/PolygonHitTest.java',
      'tests/native/PolygonHitParity.java',
    ],
    { stdio: 'pipe' },
  );
  const tokens = [cases.length];
  for (const { point, rings } of cases) {
    tokens.push(...point, rings.length);
    for (const ring of rings) tokens.push(ring.length, ...ring.flat());
  }
  const input = tokens.join(' ') + '\n';
  for (const [platform, command, args] of [
    ['iOS', binary, []],
    ['Android', 'java', ['-cp', output, 'PolygonHitParity']],
  ]) {
    const values = execFileSync(command, args, {
      input,
      encoding: 'utf8',
      timeout: 10000,
    })
      .trim()
      .split(/\s+/);
    assert.equal(values.length, cases.length, `${platform}: result count`);
    for (const [index, fixture] of cases.entries()) {
      assert.equal(
        values[index],
        fixture.expected ? '1' : '0',
        `${platform}: ${fixture.label}`,
      );
    }
  }
});
