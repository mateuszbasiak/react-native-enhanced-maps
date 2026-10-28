import { test } from 'node:test';
import assert from 'node:assert/strict';
const load = () => import('../packages/maps/lib/rnMapsCompat.js');
test('regions preserve dateline coverage and reject invalid spans', async () => {
  const { regionCoordinates, regionFromBounds } = await load();
  assert.deepEqual(
    regionCoordinates({
      latitude: 10,
      longitude: 179,
      latitudeDelta: 4,
      longitudeDelta: 6,
    }),
    [
      { latitude: 8, longitude: 176 },
      { latitude: 12, longitude: -178 },
    ],
  );
  assert.deepEqual(
    regionFromBounds({ north: 12, south: 8, east: -178, west: 176 }),
    { latitude: 10, longitude: 179, latitudeDelta: 4, longitudeDelta: 6 },
  );
  for (const latitudeDelta of [0, -1, NaN, 181])
    assert.throws(() =>
      regionCoordinates({
        latitude: 0,
        longitude: 0,
        latitudeDelta,
        longitudeDelta: 1,
      }),
    );
});
test('partial cameras preserve native values and duration options validate', async () => {
  const { mergeCamera, cameraDuration, fitOptions } = await load();
  const current = {
    center: { latitude: 1, longitude: 2 },
    zoom: 8,
    heading: 30,
    pitch: 20,
  };
  assert.deepEqual(mergeCamera(current, { zoom: 10 }), {
    ...current,
    zoom: 10,
  });
  assert.throws(() => mergeCamera(current, { zoom: NaN }));
  assert.equal(cameraDuration({ duration: 100 }), 100);
  assert.equal(cameraDuration(0), 0);
  assert.throws(() => cameraDuration({ duration: -1 }));
  assert.deepEqual(
    fitOptions({
      animated: false,
      edgePadding: { top: 1, right: 2, bottom: 3, left: 4 },
    }),
    { padding: { top: 1, right: 2, bottom: 3, left: 4 }, durationMs: 0 },
  );
});
test('authoritative native camera query validates payloads', async () => {
  const { parseMapQueryResult } =
    await import('../packages/maps/lib/mapQueries.js');
  const value = {
    center: { latitude: 1, longitude: 2 },
    zoom: 8,
    heading: 30,
    pitch: 20,
  };
  assert.deepEqual(parseMapQueryResult('camera', JSON.stringify(value)), value);
  assert.throws(() => parseMapQueryResult('camera', '{"zoom":8}'));
});
test('region native snapshots reject stale or invalid geometry and preserve gesture provenance', async () => {
  const { parseRegionEvent } = await load();
  const sample = {
    latitude: 10,
    longitude: 179,
    latitudeDelta: 4,
    longitudeDelta: 6,
    isGesture: true,
    complete: false,
    styleRevision: 2,
  };
  assert.deepEqual(parseRegionEvent(sample, 2), {
    region: {
      latitude: 10,
      longitude: 179,
      latitudeDelta: 4,
      longitudeDelta: 6,
    },
    details: { isGesture: true },
    complete: false,
  });
  assert.equal(parseRegionEvent(sample, 3), null);
  assert.equal(parseRegionEvent({ ...sample, latitudeDelta: NaN }, 2), null);
});
test('wide regions carry an explicit longitude span rather than choosing the short arc', async () => {
  const { regionRequest } = await load();
  const request = regionRequest(
    { latitude: 0, longitude: 0, latitudeDelta: 40, longitudeDelta: 270 },
    0,
  );
  assert.equal(request.regionLongitude, 0);
  assert.equal(request.regionLongitudeDelta, 270);
  assert.equal(request.durationMs, 0);
});
test('camera command queue serializes partial updates and skips obsolete controlled work', async () => {
  const { createCameraCommandQueue } = await load();
  const queue = createCameraCommandQueue();
  let camera = { zoom: 8, heading: 0 };
  const update = (patch) =>
    queue(async () => {
      const read = { ...camera };
      await Promise.resolve();
      camera = { ...read, ...patch };
    });
  await Promise.all([update({ zoom: 12 }), update({ heading: 90 })]);
  assert.deepEqual(camera, { zoom: 12, heading: 90 });
  let ran = false;
  await queue(
    async () => {
      ran = true;
    },
    () => false,
  );
  assert.equal(ran, false);
  await assert.rejects(
    queue(async () => {
      throw new Error('native failure');
    }),
  );
  await update({ zoom: 10 });
  assert.equal(camera.zoom, 10);
});

test('exact full-world regions reject instead of collapsing world-edge fit corners', async () => {
  const { regionRequest } = await load();
  assert.throws(() =>
    regionRequest({
      latitude: 0,
      longitude: 0,
      latitudeDelta: 10,
      longitudeDelta: 360,
    }),
  );
});
test('provider-specific settings and unsupported marker features fail explicitly', async () => {
  const { rejectUnsupportedProps } = await load();
  assert.throws(
    () => rejectUnsupportedProps({ provider: 'google' }, 'MapView'),
    /provider/,
  );
  assert.doesNotThrow(() =>
    rejectUnsupportedProps(
      {
        title: 'Callout',
        description: 'Boat',
        calloutAnchor: { x: 0.5, y: 0 },
        calloutOffset: { x: 0, y: 0 },
      },
      'Marker',
    ),
  );
  assert.doesNotThrow(() =>
    rejectUnsupportedProps({ initialRegion: {} }, 'MapView'),
  );
});

test('controlled viewport signatures compare values independent of property order', async () => {
  const { controlledViewportSignature } = await load();
  const region = {
    latitude: 1,
    longitude: 2,
    latitudeDelta: 3,
    longitudeDelta: 4,
  };
  assert.equal(
    controlledViewportSignature(undefined, region),
    controlledViewportSignature(undefined, {
      longitudeDelta: 4,
      latitudeDelta: 3,
      longitude: 2,
      latitude: 1,
    }),
  );
  const camera = {
    center: { latitude: 1, longitude: 2 },
    zoom: 8,
    heading: 30,
    pitch: 20,
  };
  assert.equal(
    controlledViewportSignature(camera, region),
    controlledViewportSignature({
      pitch: 20,
      heading: 30,
      zoom: 8,
      center: { longitude: 2, latitude: 1 },
    }),
  );
  assert.notEqual(
    controlledViewportSignature(camera),
    controlledViewportSignature({ ...camera, zoom: 9 }),
  );
  assert.notEqual(
    controlledViewportSignature(camera),
    controlledViewportSignature({ zoom: 8 }),
  );
  assert.notEqual(
    controlledViewportSignature(undefined, region),
    controlledViewportSignature(),
  );
});

test('queued controlled bursts skip superseded requests and retain the last command', async () => {
  const { createCameraCommandQueue } = await load();
  const queue = createCameraCommandQueue();
  let release;
  const blocker = queue(
    () =>
      new Promise((resolve) => {
        release = resolve;
      }),
  );
  await Promise.resolve();
  let version = 0;
  const applied = [];
  const pending = Array.from({ length: 100 }, (_, index) => {
    const ownVersion = ++version;
    return queue(
      async () => {
        applied.push(index);
      },
      () => ownVersion === version,
    );
  });
  release();
  await Promise.all([blocker, ...pending]);
  assert.deepEqual(applied, [99]);
});

test('invalid controlled fields remain distinct from omitted fields for validation', async () => {
  const { controlledViewportSignature } = await load();
  assert.notEqual(
    controlledViewportSignature({ heading: 30 }),
    controlledViewportSignature({ heading: 30, zoom: NaN }),
  );
  assert.notEqual(
    controlledViewportSignature({ heading: 30 }),
    controlledViewportSignature({ heading: 30, center: null }),
  );
});

test('unsupported controlled camera properties still trigger validation', async () => {
  const { controlledViewportSignature } = await load();
  const camera = {
    center: { latitude: 1, longitude: 2 },
    zoom: 8,
    heading: 0,
    pitch: 0,
  };
  assert.notEqual(
    controlledViewportSignature(camera),
    controlledViewportSignature({ ...camera, altitude: 100 }),
  );
});
