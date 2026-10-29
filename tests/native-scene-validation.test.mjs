import { test } from 'node:test';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import React from 'react';
import { fixtures } from './fixtures/nativeScene.mjs';
const output = 'artifacts/native-tests/scene';
async function load(module) {
  const url = new URL(`../packages/maps/lib/${module}.js`, import.meta.url);
  const code = readFileSync(url, 'utf8')
    .replace("from 'react'", `from '${import.meta.resolve('react')}'`)
    .replace(
      /from '(\.\/[^']+)'/g,
      (_, path) => `from '${new URL(path + '.js', url).href}'`,
    );
  return import(
    `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`
  );
}
const { compileScene } = await load('maplibreContent');
const { Circle, Polyline, Polygon } =
  await import('../packages/maps/lib/mapContent.js');
for (const [label, component, props] of [
  [
    'dateline circle',
    Circle,
    { center: { latitude: 0, longitude: 179.9 }, radius: 30000 },
  ],
  [
    'gradient geodesic',
    Polyline,
    {
      coordinates: [
        { latitude: 1, longitude: 179 },
        { latitude: 2, longitude: -179 },
      ],
      geodesic: true,
      strokeColors: ['#ff0000', '#0000ff'],
    },
  ],
  [
    'long ID polygon',
    Polygon,
    {
      id: 'a'.repeat(128),
      coordinates: [
        { latitude: 0, longitude: 0 },
        { latitude: 1, longitude: 0 },
        { latitude: 0, longitude: 1 },
      ],
    },
  ],
])
  fixtures.push({
    label,
    scene: JSON.parse(compileScene(React.createElement(component, props)).json),
    accepted: true,
  });
const batchScene = JSON.parse(
  compileScene(
    Array.from({ length: 200 }, (_, i) =>
      React.createElement(Polygon, {
        id: 'batch-' + i,
        coordinates: [
          { latitude: 0, longitude: 0 },
          { latitude: 1, longitude: 0 },
          { latitude: 0, longitude: 1 },
        ],
        fillColor: i % 2 ? 'red' : 'blue',
      }),
    ),
  ).json,
);
fixtures.push({
  label: '200 batched polygons',
  scene: batchScene,
  accepted: true,
});
for (const value of [-1, 0.5, '0', true, null]) {
  const scene = structuredClone(batchScene);
  scene.layers[0].shapeGroup = value;
  fixtures.push({
    label: 'invalid batch group ' + JSON.stringify(value),
    scene,
    accepted: false,
  });
}
for (const [label, mutate] of [
  [
    'batch source must be generated',
    (s) => delete s.sources[0].coordinateSpace,
  ],
  [
    'batch features need properties',
    (s) => (s.sources[0].data.features[0].properties = null),
  ],
  [
    'batch cannot use cluster filters',
    (s) => (s.layers[0].clusterFilter = 'points'),
  ],
  ['batch cannot use a circle layer', (s) => (s.layers[0].type = 'circle')],
]) {
  const scene = structuredClone(batchScene);
  mutate(scene);
  fixtures.push({ label, scene, accepted: false });
}
const { UrlTile } = await import('../packages/maps/lib/UrlTile.js');
const tmsScene = JSON.parse(
  compileScene(
    React.createElement(UrlTile, {
      urlTemplate: 'https://example.com/{z}/{x}/{y}.png',
      flipY: true,
    }),
  ).json,
);
fixtures.push({
  label: 'TMS raster addressing',
  scene: tmsScene,
  accepted: true,
});
for (const scheme of ['xyz', 'other', true, 1, null]) {
  const scene = structuredClone(tmsScene);
  scene.sources[0].scheme = scheme;
  fixtures.push({
    label: 'invalid raster scheme ' + JSON.stringify(scheme),
    scene,
    accepted: false,
  });
}
const { Heatmap } = await import('../packages/maps/lib/heatmap.js');
const heatmapScene = JSON.parse(
  compileScene(
    React.createElement(Heatmap, {
      points: [{ latitude: 0, longitude: 0, weight: 2 }],
    }),
  ).json,
);
fixtures.push({
  label: 'weighted heatmap',
  scene: heatmapScene,
  accepted: true,
});
for (const [label, mutate] of [
  ['heatmap invalid radius', (s) => (s.layers[0].style.heatmapRadius = -1)],
  ['heatmap invalid opacity', (s) => (s.layers[0].style.heatmapOpacity = 2)],
  [
    'heatmap bad gradient color',
    (s) => (s.layers[0].style.heatmapGradient[0][1] = 'invalid'),
  ],
  [
    'heatmap duplicate stop',
    (s) => (s.layers[0].style.heatmapGradient[1][0] = 0),
  ],
  [
    'heatmap unknown expression',
    (s) => (s.layers[0].style.heatmapWeight = ['get', 'untrusted']),
  ],
]) {
  const scene = structuredClone(heatmapScene);
  mutate(scene);
  fixtures.push({ label, scene, accepted: false });
}
const { WMSTile, LocalTile } = await import('../packages/maps/lib/rnTiles.js');
for (const [label, component, props] of [
  [
    'WMS tile',
    WMSTile,
    {
      urlTemplate:
        'https://example.com/wms?bbox={minX},{minY},{maxX},{maxY}&width={width}&height={height}',
    },
  ],
  ['local tile', LocalTile, { pathTemplate: '/tmp/tiles/{z}/{x}/{y}.png' }],
]) {
  const scene = JSON.parse(
    compileScene(React.createElement(component, props)).json,
  );
  fixtures.push({ label, scene, accepted: true });
  for (const [suffix, mutate] of [
    ['wrong tile kind', (s) => (s.sources[0].tileKind = 'unknown')],
    [
      'wrong URI',
      (s) => (s.sources[0].urlTemplate = 'https://example.com/{z}/{x}/{y}.png'),
    ],
  ]) {
    const invalid = structuredClone(scene);
    mutate(invalid);
    fixtures.push({ label: label + suffix, scene: invalid, accepted: false });
  }
}
const { Overlay } = await import('../packages/maps/lib/imageOverlay.js');
const overlayScene = JSON.parse(
  compileScene(
    React.createElement(Overlay, {
      image: { uri: 'https://example.com/image.png' },
      bounds: [
        [2, 3],
        [0, 1],
      ],
      tappable: true,
      onPress: () => {},
    }),
  ).json,
);
fixtures.push({
  label: 'image overlay and hit geometry',
  scene: overlayScene,
  accepted: true,
});
for (const [label, mutate] of [
  ['overlay malformed quad', (s) => s.sources[0].coordinates.pop()],
  ['overlay nonfinite corner', (s) => (s.sources[0].coordinates[0][0] = null)],
  [
    'overlay unsupported URI',
    (s) => (s.sources[0].uri = 'data:image/png;base64,large'),
  ],
  ['overlay unknown field', (s) => (s.sources[0].untrusted = true)],
]) {
  const scene = structuredClone(overlayScene);
  mutate(scene);
  fixtures.push({ label, scene, accepted: false });
}
mkdirSync(output, { recursive: true });
writeFileSync(output + '/fixtures.json', JSON.stringify(fixtures));
const chunks = [];
function size(n) {
  const b = Buffer.alloc(4);
  b.writeUInt32BE(n);
  chunks.push(b);
}
function encode(v) {
  if (v === null) chunks.push(Buffer.from([0]));
  else if (typeof v === 'boolean') chunks.push(Buffer.from([v ? 2 : 1]));
  else if (typeof v === 'number') {
    const b = Buffer.alloc(9);
    b[0] = 3;
    b.writeDoubleBE(v, 1);
    chunks.push(b);
  } else if (typeof v === 'string') {
    const b = Buffer.from(v);
    chunks.push(Buffer.from([4]));
    size(b.length);
    chunks.push(b);
  } else if (Array.isArray(v)) {
    chunks.push(Buffer.from([5]));
    size(v.length);
    v.forEach(encode);
  } else {
    chunks.push(Buffer.from([6]));
    size(Object.keys(v).length);
    for (const [k, x] of Object.entries(v)) {
      encode(k);
      encode(x);
    }
  }
}
encode(fixtures);
writeFileSync(output + '/fixtures.bin', Buffer.concat(chunks));
test('Android scene preflight enforces graph and style boundaries', () => {
  execFileSync('javac', [
    '-d',
    output,
    'packages/maps/android/src/main/java/com/enhancedmaps/GeoJSONValidation.java',
    'packages/maps/android/src/main/java/com/enhancedmaps/SceneValidation.java',
    'tests/native/GeoJSONValidationTest.java',
    'tests/native/SceneValidationTest.java',
  ]);
  execFileSync('java', [
    '-cp',
    output,
    'SceneValidationTest',
    output + '/fixtures.bin',
  ]);
});
test(
  'Foundation scene preflight enforces the same graph and style boundaries',
  { skip: process.platform !== 'darwin' },
  () => {
    execFileSync('clang', [
      '-fobjc-arc',
      '-framework',
      'Foundation',
      '-Ipackages/maps/ios',
      'tests/native/SceneValidationTest.m',
      '-o',
      output + '/scene-validation',
    ]);
    execFileSync(output + '/scene-validation', [output + '/fixtures.json']);
  },
);
