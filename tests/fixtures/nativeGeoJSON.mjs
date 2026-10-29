import React from 'react';
import {
  Circle,
  Polyline,
  Polygon,
  compileMapContent,
} from '../../packages/maps/lib/mapContent.js';
import { nativeShapes } from '../../packages/maps/lib/nativeShapes.js';

const feature = (geometry, id = 'fixture', properties = null) => ({
  type: 'Feature',
  id,
  properties,
  geometry,
});
const collection = (geometry, id, properties) => ({
  type: 'FeatureCollection',
  features: [feature(geometry, id, properties)],
});
const outer = [
  [170, -10],
  [-170, -10],
  [-170, 10],
  [170, 10],
  [170, -10],
];
const hole = [
  [175, -2],
  [175, 2],
  [-175, 2],
  [-175, -2],
  [175, -2],
];
const geometries = [
  [{ type: 'Point', coordinates: [180, 90] }, 1, []],
  [
    {
      type: 'MultiPoint',
      coordinates: [
        [-180, -90],
        [180, 90],
      ],
    },
    2,
    [0],
  ],
  [
    {
      type: 'LineString',
      coordinates: [
        [179, 0],
        [-179, 0],
      ],
    },
    2,
    [0],
  ],
  [
    {
      type: 'MultiLineString',
      coordinates: [
        [
          [179, 0],
          [-179, 0],
        ],
        [
          [0, -90],
          [0, 90],
        ],
      ],
    },
    4,
    [0, 0],
  ],
  [{ type: 'Polygon', coordinates: [outer, hole] }, 10, [1, 0]],
  [
    {
      type: 'MultiPolygon',
      coordinates: [[outer, hole], [outer.toReversed()]],
    },
    15,
    [0, 1, 0],
  ],
];
export function nativeGeoJSONFixtures() {
  const cases = [];
  const add = (label, data, positions = null) =>
    cases.push({ label, data, positions });
  for (const [geometry, positions, path] of geometries) {
    add(
      geometry.type + ' valid',
      collection(structuredClone(geometry)),
      positions,
    );
    for (const [label, axis, value] of [
      ['string', 0, '12'],
      ['boolean', 1, true],
      ['null', 0, null],
      ['longitude range', 0, 181],
      ['latitude range', 1, -91],
    ]) {
      const copy = structuredClone(geometry);
      const point = path.reduce(
        (value, index) => value[index],
        copy.coordinates,
      );
      point[axis] = value;
      add(geometry.type + ' ' + label, collection(copy));
    }
    for (const length of [0, 1, 3]) {
      const copy = structuredClone(geometry);
      const invalid = Array.from({ length }, (_, index) => index);
      if (!path.length) copy.coordinates = invalid;
      else
        path
          .slice(0, -1)
          .reduce((value, index) => value[index], copy.coordinates)[
          path.at(-1)
        ] = invalid;
      add(geometry.type + ' tuple ' + length, collection(copy));
    }
    const absent = structuredClone(geometry);
    delete absent.coordinates;
    add(geometry.type + ' missing coordinates', collection(absent));
    add(
      geometry.type + ' null coordinates',
      collection({ ...geometry, coordinates: null }),
    );
  }
  for (const type of ['MultiPoint', 'MultiLineString', 'MultiPolygon'])
    add(type + ' empty', collection({ type, coordinates: [] }), 0);
  for (const geometry of [
    null,
    { type: 'GeometryCollection', geometries: [] },
    { type: 'Unknown', coordinates: [] },
    { type: 'LineString', coordinates: [[1, 2]] },
    { type: 'Polygon', coordinates: [] },
    {
      type: 'Polygon',
      coordinates: [
        [
          [0, 0],
          [1, 0],
          [0, 0],
        ],
      ],
    },
    {
      type: 'Polygon',
      coordinates: [
        [
          [0, 0],
          [1, 0],
          [1, 1],
          [0, 1],
        ],
      ],
    },
    {
      type: 'Polygon',
      coordinates: [
        outer,
        [
          [0, 0],
          [1, 0],
          [1, 1],
          [0, 1],
        ],
      ],
    },
    { type: 'MultiLineString', coordinates: [null] },
    { type: 'MultiPolygon', coordinates: [[]] },
  ])
    add('invalid geometry ' + cases.length, collection(geometry));
  const point = { type: 'Point', coordinates: [0, -0] };
  add('null source', null);
  add('bare geometry', point);
  add('missing features', { type: 'FeatureCollection' });
  add('null features', { type: 'FeatureCollection', features: null });
  add('features object', { type: 'FeatureCollection', features: {} });
  add('empty source', { type: 'FeatureCollection', features: [] }, 0);
  add('null feature', { type: 'FeatureCollection', features: [null] });
  const wrong = collection(point);
  wrong.features[0].type = 'Point';
  add('wrong feature type', wrong);
  for (const id of ['', null, 42, 'x'.repeat(513)])
    add('invalid feature ID ' + cases.length, collection(point, id));
  for (const id of ['x'.repeat(512), 'marker / key:海 🌊'])
    add('marker-compatible ID ' + cases.length, collection(point, id), 1);
  add('duplicate ID', {
    type: 'FeatureCollection',
    features: [feature(point), feature(point)],
  });
  add(
    'distinct Unicode ID encodings',
    {
      type: 'FeatureCollection',
      features: [feature(point, 'é'), feature(point, 'e\u0301')],
    },
    2,
  );
  add('UTF-16 ID boundary', collection(point, '🌊'.repeat(256)), 1);
  add('UTF-16 ID overflow', collection(point, '🌊'.repeat(257)));
  for (const properties of [[], true, 42, 'string'])
    add(
      'invalid properties ' + cases.length,
      collection(point, 'fixture', properties),
    );
  const missing = collection(point);
  delete missing.features[0].properties;
  add('missing properties', missing);
  add(
    'object properties',
    collection(point, 'fixture', {
      nested: [null, true, 1, 'value', { a: 2 }],
    }),
    1,
  );
  for (const count of [50000, 50001])
    add(
      'position bound ' + count,
      collection({
        type: 'MultiPoint',
        coordinates: Array.from({ length: count }, () => [1, 2]),
      }),
      count,
    );
  for (const count of [10000, 10001])
    add(
      'feature count ' + count,
      {
        type: 'FeatureCollection',
        features: Array.from({ length: count }, (_, i) =>
          feature(point, 'f' + i),
        ),
      },
      count,
    );
  const generated = [
    React.createElement(Polyline, {
      id: 'dateline-route',
      geodesic: true,
      coordinates: [
        { latitude: 0, longitude: 179 },
        { latitude: 0, longitude: -179 },
      ],
    }),
    React.createElement(Circle, {
      id: 'dateline-circle',
      center: { latitude: 0, longitude: 179.9 },
      radius: 50000,
    }),
    React.createElement(Polygon, {
      id: 'dateline-hole',
      geodesic: true,
      coordinates: [
        { latitude: 55, longitude: 170 },
        { latitude: 55, longitude: -170 },
        { latitude: 40, longitude: 180 },
      ],
      holes: [
        [
          { latitude: 50, longitude: -179 },
          { latitude: 50, longitude: 179 },
          { latitude: 48, longitude: 180 },
        ],
      ],
    }),
    React.createElement(Polyline, {
      id: 'multi-world-route',
      geodesic: true,
      coordinates: [
        { latitude: 0, longitude: 0 },
        ...Array.from({ length: 4 }, () => [120, -120, 0])
          .flat()
          .map((longitude) => ({ latitude: 0, longitude })),
      ],
    }),
    React.createElement(Circle, {
      id: 'empty-circle',
      center: { latitude: 0, longitude: 179.9 },
      radius: 0,
    }),
  ];
  for (const element of generated) {
    const source = nativeShapes(compileMapContent(element), {
      sources: [],
      layers: [],
    }).sources[0];
    const count = (value) =>
      !Array.isArray(value) || !value.length
        ? 0
        : typeof value[0] === 'number'
          ? 1
          : value.reduce((sum, part) => sum + count(part), 0);
    const positions = source.data.features.reduce(
      (sum, f) => sum + count(f.geometry.coordinates),
      0,
    );
    cases.push({
      label: 'generated ' + source.id,
      data: source.data,
      positions,
      generatedShape: true,
    });
  }
  const shape = (
    label,
    geometry,
    positions = null,
    id = 'geometry',
    properties = null,
  ) =>
    cases.push({
      label,
      data: collection(geometry, id, properties),
      positions,
      generatedShape: true,
    });
  shape('generated point rejected', { type: 'Point', coordinates: [181, 0] });
  shape(
    'generated wrong ID',
    {
      type: 'LineString',
      coordinates: [
        [179, 0],
        [181, 0],
      ],
    },
    null,
    'wrong',
  );
  shape(
    'generated properties rejected',
    {
      type: 'LineString',
      coordinates: [
        [179, 0],
        [181, 0],
      ],
    },
    null,
    'geometry',
    {},
  );
  shape(
    'generated longitude bound',
    {
      type: 'LineString',
      coordinates: [
        [1799999, 0],
        [1800000, 0],
      ],
    },
    2,
  );
  shape(
    'generated long world-copy route',
    {
      type: 'LineString',
      coordinates: [
        [1800000, 0],
        [1800001, 0],
      ],
    },
    2,
  );
  shape(
    'generated world copy has no byte-derived envelope',
    {
      type: 'LineString',
      coordinates: [
        [180 * (Math.floor((4 * 1024 * 1024) / 6) + 1) + 1, 0],
        [0, 0],
      ],
    },
    2,
  );
  shape(
    'generated latitude bound',
    {
      type: 'LineString',
      coordinates: [
        [179, 90],
        [181, 90],
      ],
    },
    2,
  );
  shape('generated latitude rejected', {
    type: 'LineString',
    coordinates: [
      [179, 0],
      [181, 91],
    ],
  });
  shape('generated string axis rejected', {
    type: 'LineString',
    coordinates: [
      [179, 0],
      ['181', 0],
    ],
  });
  for (const count of [10000, 10001])
    shape(
      'generated position bound ' + count,
      {
        type: 'LineString',
        coordinates: Array.from({ length: count }, () => [179, 0]),
      },
      count,
    );
  return cases;
}
