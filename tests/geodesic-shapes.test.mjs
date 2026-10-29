import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
const load = () => import('../packages/maps/lib/mapContent.js');
const route = [
  { latitude: 55, longitude: -60 },
  { latitude: 55, longitude: 60 },
];
const triangle = [
  { latitude: 55, longitude: 170 },
  { latitude: 55, longitude: -170 },
  { latitude: 40, longitude: 180 },
];
const hole = [
  { latitude: 50, longitude: -179 },
  { latitude: 50, longitude: 179 },
  { latitude: 48, longitude: 180 },
];
const vector = (p) => {
  const lat = (p.latitude * Math.PI) / 180;
  const lon = (p.longitude * Math.PI) / 180;
  return [
    Math.cos(lat) * Math.cos(lon),
    Math.cos(lat) * Math.sin(lon),
    Math.sin(lat),
  ];
};
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const dot = (a, b) => a.reduce((sum, v, i) => sum + v * b[i], 0);

test('geodesic polyline follows the shortest spherical arc with bounded steps', async () => {
  const { compileMapContent, Polyline } = await load();
  const points = compileMapContent(
    React.createElement(Polyline, { coordinates: route, geodesic: true }),
  ).items[0].coordinates;
  assert(points.length > 100);
  assert.deepEqual(points[0], route[0]);
  assert.deepEqual(points.at(-1), route[1]);
  const peak = points.reduce((a, b) => (a.latitude > b.latitude ? a : b));
  const expectedPeak =
    (Math.atan(
      Math.tan((55 * Math.PI) / 180) / Math.cos((60 * Math.PI) / 180),
    ) *
      180) /
    Math.PI;
  assert(Math.abs(peak.latitude - expectedPeak) < 0.001);
  assert(Math.abs(peak.longitude) < 0.5);
  const normal = cross(vector(route[0]), vector(route[1]));
  points.forEach((p, i) => {
    assert(
      Math.abs(dot(normal, vector(p))) < 1e-12,
      'point must lie on the great-circle plane',
    );
    if (i) {
      const a = vector(points[i - 1]),
        b = vector(p);
      const angle = Math.atan2(Math.hypot(...cross(a, b)), dot(a, b));
      assert(angle <= (0.25 * Math.PI) / 180 + 1e-12);
    }
  });
});

test('default and false retain original geometry while geodesic style updates reuse sources', async () => {
  const { compileMapContent, Polyline } = await load();
  const { nativeShapes } = await import('../packages/maps/lib/nativeShapes.js');
  const make = (props) =>
    compileMapContent(
      React.createElement(Polyline, {
        id: 'route',
        coordinates: route,
        ...props,
      }),
    );
  const plain = make({});
  assert.equal(
    plain.items[0].coordinates,
    make({ geodesic: false }).items[0].coordinates,
  );
  assert.equal(plain.items[0].coordinates.length, 2);
  const arc = make({ geodesic: true });
  const styled = make({ geodesic: true, strokeWidth: 8 });
  assert.equal(arc.items[0].coordinates, styled.items[0].coordinates);
  const native = nativeShapes(arc, { sources: [], layers: [] });
  assert.equal(nativeShapes(styled, native).sources, native.sources);
  assert.equal(nativeShapes(plain, native).sources[0].revision, 1);
});

test('dateline geodesic polygons keep closed outer and hole paths in the same world copy', async () => {
  const { compileMapContent, Polygon } = await load();
  const holes = [hole];
  const make = (width) =>
    compileMapContent(
      React.createElement(Polygon, {
        coordinates: triangle,
        holes,
        geodesic: true,
        strokeWidth: width,
      }),
    );
  const item = make(2).items[0];
  assert(item.coordinates.length > 4);
  for (const ring of [item.coordinates, ...item.holes]) {
    assert.deepEqual(ring[0], ring.at(-1));
    assert(ring.every((p) => p.longitude > 160 && p.longitude < 200));
    assert(
      ring.every(
        (p, i) => i === 0 || Math.abs(p.longitude - ring[i - 1].longitude) < 1,
      ),
    );
  }
  assert.equal(item.coordinates, make(8).items[0].coordinates);
  assert.equal(item.holes, make(8).items[0].holes);
});

test('coincident points remain finite and equatorial dateline routes take the short arc', async () => {
  const { compileMapContent, Polyline } = await load();
  const same = { latitude: 50, longitude: 10 };
  const p = compileMapContent(
    React.createElement(Polyline, {
      coordinates: [same, same],
      geodesic: true,
    }),
  ).items[0].coordinates;
  assert.deepEqual(p, [same, same]);
  const points = compileMapContent(
    React.createElement(Polyline, {
      coordinates: [
        { latitude: 0, longitude: 179 },
        { latitude: 0, longitude: -179 },
      ],
      geodesic: true,
    }),
  ).items[0].coordinates;
  assert.equal(points[0].longitude, 179);
  assert.equal(points.at(-1).longitude, 181);
  assert(points.every((p) => Math.abs(p.latitude) < 1e-10));
});

test('geodesic validates flags, rejects non-unique and unsupported polar arcs, and leaves Circle explicit', async () => {
  const { compileMapContent, Polyline, Polygon, Circle } = await load();
  for (const geodesic of ['yes', 1, null])
    assert.throws(
      () =>
        compileMapContent(
          React.createElement(Polyline, { coordinates: route, geodesic }),
        ),
      /boolean/i,
    );
  assert.throws(
    () =>
      compileMapContent(
        React.createElement(Polyline, {
          coordinates: [
            { latitude: 0, longitude: 0 },
            { latitude: 0, longitude: 180 },
          ],
          geodesic: true,
        }),
      ),
    /antipodal/i,
  );
  assert.throws(
    () =>
      compileMapContent(
        React.createElement(Polyline, {
          coordinates: [
            { latitude: 84, longitude: -89 },
            { latitude: 84, longitude: 89 },
          ],
          geodesic: true,
        }),
      ),
    /latitude/i,
  );
  assert.throws(
    () =>
      compileMapContent(
        React.createElement(Polygon, {
          coordinates: [
            { latitude: 70, longitude: -120 },
            { latitude: 70, longitude: 0 },
            { latitude: 70, longitude: 120 },
          ],
          geodesic: true,
        }),
      ),
    /winding|pole/i,
  );
  assert.throws(
    () =>
      compileMapContent(
        React.createElement(Circle, {
          center: route[0],
          radius: 100,
          geodesic: true,
        }),
      ),
    /unsupported/i,
  );
});

test('generated geodesic positions can exceed the former individual and aggregate caps', async () => {
  const { compileMapContent, Polyline } = await load();
  const long = Array.from({ length: 16 }, (_, i) => ({
    latitude: 0,
    longitude: i % 2 ? 179 : 0,
  }));
  assert.doesNotThrow(() =>
    compileMapContent(
      React.createElement(Polyline, { coordinates: long, geodesic: true }),
    ),
  );
  const shorter = long.slice(0, 9);
  assert.doesNotThrow(() =>
    compileMapContent([
      React.createElement(Polyline, {
        id: 'a',
        coordinates: shorter,
        geodesic: true,
      }),
      React.createElement(Polyline, {
        id: 'b',
        coordinates: shorter,
        geodesic: true,
      }),
    ]),
  );
});

test('latitude extrema are checked between generated samples', async () => {
  const { compileMapContent, Polyline } = await load();
  const radians = Math.PI / 180;
  const longitude =
    Math.acos(Math.tan(84 * radians) / Math.tan(85.000001 * radians)) / radians;
  assert.throws(
    () =>
      compileMapContent(
        React.createElement(Polyline, {
          coordinates: [
            { latitude: 84, longitude: -longitude },
            { latitude: 84, longitude },
          ],
          geodesic: true,
        }),
      ),
    /latitude/i,
  );
});

test('hole world alignment uses the exterior rather than its first vertex', async () => {
  const { compileMapContent, Polygon } = await load();
  const outer = [
    { latitude: -10, longitude: -170 },
    { latitude: -10, longitude: 0 },
    { latitude: -10, longitude: 170 },
    { latitude: 10, longitude: 170 },
    { latitude: 10, longitude: 0 },
    { latitude: 10, longitude: -170 },
  ];
  const holes = [
    [
      { latitude: -1, longitude: 159 },
      { latitude: -1, longitude: 161 },
      { latitude: 1, longitude: 160 },
    ],
  ];
  for (const coordinates of [
    outer,
    [...outer.slice(2), ...outer.slice(0, 2)],
  ]) {
    const item = compileMapContent(
      React.createElement(Polygon, { coordinates, holes, geodesic: true }),
    ).items[0];
    assert(
      item.holes[0].every((p) => p.longitude >= 159 && p.longitude <= 161),
    );
  }
});

test('geodesic expansion accepts geometry larger than the former scene byte budget', async () => {
  const { geodesicPathInfo } = await import('../packages/maps/lib/geodesic.js');
  let visits = 0;
  const path = Array.from({ length: 1000 }, (_, i) => ({
    latitude: 0,
    get longitude() {
      visits++;
      return i % 2 ? 179 : 0;
    },
  }));
  const result = geodesicPathInfo(path);
  assert(result.coordinates.length > 100000);
  assert(visits >= 1000, 'process the complete route');
});

test('aggregate geometry bytes do not prevent processing later shapes', async () => {
  const { compileMapContent, Polyline } = await load();
  const path = Array.from({ length: 50 }, (_, i) => ({
    latitude: 0,
    longitude: i % 2 ? 179 : 0,
  }));
  let reachedLast = false;
  const children = Array.from({ length: 10 }, (_, i) =>
    React.createElement(Polyline, {
      id: 'line' + i,
      coordinates: path,
      geodesic: true,
    }),
  );
  children.push(
    React.createElement(Polyline, {
      id: 'last',
      coordinates: [
        {
          get latitude() {
            reachedLast = true;
            return 0;
          },
          longitude: 0,
        },
        { latitude: 1, longitude: 1 },
      ],
    }),
  );
  assert.equal(compileMapContent(children).items.length, 11);
  assert.equal(reachedLast, true);
});
