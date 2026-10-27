const source = {
  id: 'source',
  data: { type: 'FeatureCollection', features: [] },
};
const layer = {
  id: 'layer',
  source: 'source',
  type: 'circle',
  style: { circleRadius: 4, circleColor: '#112233', circleOpacity: 1 },
};
const valid = () => structuredClone({ sources: [source], layers: [layer] });
export const fixtures = [];
const add = (label, change, accepted = false) => {
  const scene = valid();
  change(scene);
  fixtures.push({ label, scene, accepted });
};
add('basic', () => {}, true);
add(
  'empty',
  (s) => {
    s.sources = [];
    s.layers = [];
  },
  true,
);
add(
  'generated maximum layer ID',
  (s) => {
    s.layers[0].id = 'stroke:' + 'a'.repeat(128);
  },
  true,
);
add(
  'native generated line styles',
  (s) => {
    s.layers[0].type = 'line';
    s.layers[0].style = {
      lineColor: '#12345678',
      lineWidth: 0,
      lineOpacity: 0,
      lineCap: 'square',
      lineJoin: 'bevel',
      lineMiterLimit: 1000,
      lineDasharray: [10000000, 1],
    };
  },
  true,
);
add('unsupported type', (s) => {
  s.layers[0].type = 'unknown';
});
add('duplicate layer', (s) => {
  s.layers.push(structuredClone(s.layers[0]));
});
add('duplicate source', (s) => {
  s.sources.push(structuredClone(s.sources[0]));
});
add('missing source', (s) => {
  s.layers[0].source = 'missing';
});
add('missing before', (s) => {
  s.layers[0].beforeId = 'missing';
});
add('self before', (s) => {
  s.layers[0].beforeId = 'layer';
});
add('source scalar', (s) => {
  s.sources[0] = false;
});
add('layer scalar', (s) => {
  s.layers[0] = false;
});
add('bad source id', (s) => {
  s.sources[0].id = 'source/evil';
});
add('long source id', (s) => {
  s.sources[0].id = 'a'.repeat(129);
});
add('long layer id', (s) => {
  s.layers[0].id = 'a'.repeat(136);
});
add('nonobject style', (s) => {
  s.layers[0].style = [];
});
add('unknown style', (s) => {
  s.layers[0].style.textSize = 4;
});
add('wrong layer style', (s) => {
  s.layers[0].style.lineWidth = 4;
});
for (const value of ['4', true, null, [], {}, -1, 257])
  add('invalid radius ' + JSON.stringify(value), (s) => {
    s.layers[0].style.circleRadius = value;
  });
for (const value of ['red', '#12345g', 4, null])
  add('invalid color ' + JSON.stringify(value), (s) => {
    s.layers[0].style.circleColor = value;
  });
add('invalid opacity', (s) => {
  s.layers[0].style.circleOpacity = 1.1;
});
add('invalid bool', (s) => {
  s.layers[0].visible = 'false';
});
add('invalid interactive', (s) => {
  s.layers[0].interactive = 1;
});
add('bad filter', (s) => {
  s.layers[0].clusterFilter = 'bad';
});
add('filter without clustered source', (s) => {
  s.layers[0].clusterFilter = 'points';
});
for (const value of [[], [1], [1, 2, 3], [1, 0], [1, '2'], Array(34).fill(1)])
  add('invalid dash ' + JSON.stringify(value), (s) => {
    s.layers[0].type = 'line';
    s.layers[0].style = { lineDasharray: value };
  });
add('invalid cap', (s) => {
  s.layers[0].type = 'line';
  s.layers[0].style = { lineCap: 'invalid' };
});
add('too many sources', (s) => {
  s.sources = Array.from({ length: 65 }, (_, i) => ({
    ...source,
    id: 's' + i,
  }));
});
add('too many layers', (s) => {
  s.layers = Array.from({ length: 129 }, (_, i) => ({ ...layer, id: 'l' + i }));
});
fixtures.push({
  label: 'source collision',
  scene: valid(),
  externalSources: ['source'],
  accepted: false,
});
fixtures.push({
  label: 'layer collision',
  scene: valid(),
  externalLayers: ['layer'],
  accepted: false,
});
const before = valid();
before.layers[0].beforeId = 'basemap';
fixtures.push({
  label: 'external insertion',
  scene: before,
  externalLayers: ['basemap'],
  accepted: true,
});
const previous = valid();
previous.layers.push({ ...previous.layers[0], id: 'next', beforeId: 'layer' });
fixtures.push({
  label: 'earlier candidate insertion',
  scene: previous,
  accepted: true,
});
add('color trailing newline', (s) => {
  s.layers[0].style.circleColor = '#112233\n';
});
for (const stops of [
  [
    [0, '#112233\n'],
    [1, '#445566'],
  ],
  [
    [true, '#112233'],
    [1, '#445566'],
  ],
  [
    [0.5, '#112233'],
    [1, '#445566'],
  ],
  [
    [0, '#112233'],
    [0, '#445566'],
  ],
  [
    [0, '#112233'],
    [1, 'red'],
  ],
])
  add('invalid gradient ' + JSON.stringify(stops), (s) => {
    s.layers[0].type = 'line';
    s.layers[0].style = { lineGradient: stops };
  });
