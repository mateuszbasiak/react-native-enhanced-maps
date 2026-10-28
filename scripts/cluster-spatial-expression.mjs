/** Validate semantic membership, without assuming native cluster IDs or order. */
export function assertClusterPartition(partition, layout, grouped) {
  const check = (ok, message) => {
    if (!ok) throw Error(message);
  };
  check(
    Array.isArray(partition) && partition.length > 0,
    'No visible clusters',
  );
  const seen = new Set();
  for (const cluster of partition) {
    check(
      Number.isInteger(cluster.count) &&
        cluster.count >= 2 &&
        cluster.count === cluster.members.length,
      'Cluster count mismatch',
    );
    check(
      Number.isFinite(cluster.coordinate.latitude) &&
        Math.abs(cluster.coordinate.latitude) <= 85 &&
        Number.isFinite(cluster.coordinate.longitude) &&
        Math.abs(cluster.coordinate.longitude) <= 180,
      'Invalid cluster coordinate',
    );
    for (const member of cluster.members) {
      check(/^vessel-\d+$/.test(member.id), 'Unexpected member ID');
      const index = Number(member.id.slice(7));
      check(
        index >= 0 &&
          index < 12 &&
          member.id === `vessel-${index}` &&
          !seen.has(member.id),
        'Duplicate or out-of-range member',
      );
      seen.add(member.id);
      const latitude =
        layout === 'spatial'
          ? (Math.floor(index / 3) % 2 ? 0.1 : -0.1) + (index % 3) * 0.00001
          : (index % 3) * 0.00001;
      const longitude =
        layout === 'spatial'
          ? (Math.floor(index / 6) % 2 ? 0.2 : -0.2) + (index % 3) * 0.00001
          : (index % 6 < 3 ? 179.8 : -179.8) + (index % 3) * 0.00001;
      check(
        Math.abs(member.coordinate.latitude - latitude) < 1e-8 &&
          Math.abs(member.coordinate.longitude - longitude) < 1e-8,
        'Member coordinate mismatch',
      );
      const status = index % 2 ? 'moving' : 'moored';
      check(
        member.data?.name === `Vessel ${index}` &&
          member.data?.status === status,
        'Member metadata mismatch',
      );
      check(
        grouped
          ? cluster.clusterGroup === status
          : cluster.clusterGroup === undefined,
        'Cluster group mismatch',
      );
    }
    // These fixtures form tiny islands. Compare their centroid across wrapping,
    // allowing SDK index quantization rather than requiring byte-identical floats.
    const latitude =
      cluster.members.reduce((sum, m) => sum + m.coordinate.latitude, 0) /
      cluster.members.length;
    const x = cluster.members.reduce(
      (sum, m) => sum + Math.cos((m.coordinate.longitude * Math.PI) / 180),
      0,
    );
    const y = cluster.members.reduce(
      (sum, m) => sum + Math.sin((m.coordinate.longitude * Math.PI) / 180),
      0,
    );
    const longitude = (Math.atan2(y, x) * 180) / Math.PI;
    check(
      Math.abs(cluster.coordinate.latitude - latitude) < 0.001 &&
        Math.abs(
          ((cluster.coordinate.longitude - longitude + 540) % 360) - 180,
        ) < 0.001,
      'Cluster coordinate mismatch',
    );
  }
  check(seen.size === 12, 'Missing members');
  if (layout === 'spatial') {
    check(
      partition.length === 4 && partition.every((c) => c.count === 3),
      'Spatial islands merged or split',
    );
    const islands = new Set();
    for (const cluster of partition) {
      const island = Math.floor(Number(cluster.members[0].id.slice(7)) / 3);
      check(
        cluster.members.every(
          (m) => Math.floor(Number(m.id.slice(7)) / 3) === island,
        ),
        'Spatial island membership mismatch',
      );
      check(!islands.has(island), 'Duplicate spatial island');
      islands.add(island);
    }
  }
  return [...seen].sort();
}

/** Runs only in the Debug example runtime through the CDP verification runner. */
export function assertClusterRun(result) {
  if (
    !['ios', 'android'].includes(result?.platform) ||
    result.status !== 'passed'
  )
    throw Error('Invalid runtime provenance');
  const cases = [
    ['four spatial islands', 'spatial', false, 0, 8],
    ['east dateline', 'antimeridian', false, 179.8, 5],
    ['west dateline', 'antimeridian', false, -179.8, 5],
    ['wrapped world copies', 'antimeridian', false, 0, 0],
    ['dateline group isolation', 'antimeridian', true, -179.8, 5],
    ['style replacement', 'antimeridian', true, -179.8, 5],
    ['remount', 'antimeridian', true, 179.8, 5],
  ];
  if (!Array.isArray(result.records) || result.records.length !== cases.length)
    throw Error('Incomplete runtime evidence');
  cases.forEach(([name, layout, grouped, longitude, zoom], index) => {
    const record = result.records[index];
    if (
      !record ||
      record.name !== name ||
      !Number.isInteger(record.ready) ||
      record.ready < 1 ||
      record.observations !== 3
    )
      throw Error('Missing native case evidence');
    const ids = assertClusterPartition(record.partition, layout, grouped);
    if (JSON.stringify(ids) !== JSON.stringify(record.ids))
      throw Error('Member receipt mismatch');
    const camera = record.camera;
    if (
      !camera ||
      camera.zoom < 0 ||
      camera.zoom > 24 ||
      ![
        camera.center?.latitude,
        camera.center?.longitude,
        camera.zoom,
        camera.heading,
        camera.pitch,
      ].every(Number.isFinite) ||
      Math.abs(camera.center.latitude) > 0.001 ||
      Math.abs(((camera.center.longitude - longitude + 540) % 360) - 180) >
        0.001 ||
      (zoom !== 0 && Math.abs(camera.zoom - zoom) > 0.01) ||
      Math.abs(camera.heading) > 0.01 ||
      Math.abs(camera.pitch) > 0.01
    )
      throw Error('Camera did not reach the test viewport');
    if (
      zoom === 0 &&
      (!Number.isFinite(record.viewport?.width) ||
        record.viewport.width / (512 * 2 ** camera.zoom) <= 1)
    )
      throw Error('World-copy case requires more than one visible world width');
  });
}

export async function assertObsoleteCluster(handle) {
  if (!handle || typeof handle.getMembers !== 'function')
    throw Error('Missing captured cluster handle');
  try {
    await handle.getMembers();
  } catch (error) {
    if (error?.message === 'Cluster is obsolete') return;
    throw error;
  }
  throw Error('Source replacement retained an obsolete cluster handle');
}

export async function runClusterSpatialChecks(api) {
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const check = (ok, message) => {
    if (!ok) throw Error(message);
  };
  const wait = async (predicate) => {
    const deadline = Date.now() + 20000;
    while (Date.now() < deadline) {
      const value = await predicate();
      if (value) return value;
      await sleep(100);
    }
    throw Error('Cluster spatial acceptance timed out');
  };
  const records = [];
  const audit = async (name, layout, grouped = false) => {
    let lastError = '';
    let signature,
      observations = 0;
    try {
      const accepted = await wait(async () => {
        try {
          const partition = await api.inspectAll();
          const ids = assertClusterPartition(partition, layout, grouped);
          const snapshot = api.snapshot();
          check(snapshot.errors.length === 0, snapshot.errors.join('; '));
          const nextSignature = JSON.stringify(
            partition
              .map((c) => ({
                count: c.count,
                coordinate: c.coordinate,
                group: c.clusterGroup,
                ids: c.members.map((m) => m.id).sort(),
              }))
              .sort((a, b) => a.ids.join().localeCompare(b.ids.join())),
          );
          observations = nextSignature === signature ? observations + 1 : 1;
          signature = nextSignature;
          if (observations < 3) return false;
          return {
            name,
            ids,
            partition,
            camera: await api.getCamera(),
            ready: snapshot.ready,
            viewport: snapshot.viewport,
            observations,
          };
        } catch (error) {
          lastError = String(error);
          observations = 0;
          signature = undefined;
          return false;
        }
      });
      check(
        accepted && accepted.partition && accepted.ids.length === 12,
        'Missing native evidence',
      );
      records.push(accepted);
    } catch {
      throw Error(name + ': ' + lastError);
    }
  };
  const camera = (longitude, zoom) =>
    api.moveCamera({
      center: { latitude: 0, longitude },
      zoom,
      heading: 0,
      pitch: 0,
    });
  api.configure({
    count: 12,
    layout: 'spatial',
    grouped: false,
    custom: true,
    present: true,
    clustered: true,
    identityCases: false,
  });
  await camera(0, 8);
  await audit('four spatial islands', 'spatial');
  const obsolete = api.capture();
  api.configure({ layout: 'antimeridian' });
  await camera(179.8, 5);
  await audit('east dateline', 'antimeridian');
  await assertObsoleteCluster(obsolete);
  await camera(-179.8, 5);
  await audit('west dateline', 'antimeridian');
  await camera(0, 0);
  await audit('wrapped world copies', 'antimeridian');
  api.configure({ grouped: true });
  await camera(-179.8, 5);
  await audit('dateline group isolation', 'antimeridian', true);
  const beforeStyle = api.snapshot().ready;
  api.reloadStyle();
  await wait(() => api.snapshot().ready > beforeStyle);
  await audit('style replacement', 'antimeridian', true);
  const beforeMount = api.snapshot().ready;
  api.remount();
  await wait(() => api.snapshot().ready > beforeMount);
  await camera(179.8, 5);
  await audit('remount', 'antimeridian', true);
  return { status: 'passed', platform: api.snapshot().platform, records };
}
