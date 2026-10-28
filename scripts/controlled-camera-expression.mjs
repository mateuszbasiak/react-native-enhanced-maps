/** Bounded acceptance against the Debug runtime scenario; serialized by the runner. */
export async function runControlledCameraChecks(api) {
  const check = (ok, message) => {
    if (!ok) throw Error(message);
  };
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const wait = async (predicate) => {
    for (let i = 0; i < 150; i++) {
      if (await predicate()) return;
      await sleep(100);
    }
    throw Error('Controlled-camera acceptance timed out');
  };
  const parity = api.parity;
  const map = parity.map();
  const passed = [];
  const cameraAt = (longitude) => ({
    center: { latitude: 20, longitude },
    zoom: 9,
    heading: 0,
    pitch: 0,
  });
  const regionAt = (longitude) => ({
    latitude: 20,
    longitude,
    latitudeDelta: 1,
    longitudeDelta: 1,
  });
  const longitudeIs = async (longitude) =>
    Math.abs((await map.getCamera()).center.longitude - longitude) < 0.001;
  const counts = () => parity.snapshot().regionCounts;
  const idle = async (label) => {
    await sleep(500);
    const before = counts();
    await sleep(500);
    check(
      JSON.stringify(before) === JSON.stringify(counts()),
      label + ': events continued while idle',
    );
  };
  try {
    parity.setRegion(regionAt(30));
    parity.setCamera(cameraAt(40));
    await wait(() => longitudeIs(40));
    await idle('camera precedence');
    passed.push('camera takes precedence over region');

    await map.setCamera({ center: { latitude: 20, longitude: 41 } });
    await wait(() => longitudeIs(41));
    await idle('imperative move');
    const beforeEquivalent = counts();
    for (let i = 0; i < 20; i++) {
      parity.setCamera({
        pitch: 0,
        heading: 0,
        zoom: 9,
        center: { longitude: 40, latitude: 20 },
      });
      await sleep(20);
    }
    check(await longitudeIs(41), 'equivalent camera props reset the viewport');
    check(
      JSON.stringify(beforeEquivalent) === JSON.stringify(counts()),
      'equivalent camera rerenders emitted events',
    );
    passed.push(
      'unchanged camera values allow imperative movement; 20 reordered rerenders emit no events',
    );

    parity.setCamera(undefined);
    await wait(() => longitudeIs(30));
    await idle('region fallback');
    await map.setCamera({ center: { latitude: 20, longitude: 31 } });
    await idle('region imperative move');
    const beforeRegion = counts();
    for (let i = 0; i < 20; i++) {
      parity.setRegion({
        longitudeDelta: 1,
        latitudeDelta: 1,
        longitude: 30,
        latitude: 20,
      });
      await sleep(20);
    }
    check(await longitudeIs(31), 'equivalent region props reset the viewport');
    check(
      JSON.stringify(beforeRegion) === JSON.stringify(counts()),
      'equivalent region rerenders emitted events',
    );
    passed.push(
      'removing camera activates region; 20 reordered region rerenders emit no events',
    );

    for (let i = 0; i < 20; i++) {
      parity.setCamera(cameraAt(40 + i / 10));
      await sleep(20);
    }
    await wait(() => longitudeIs(41.9));
    await idle('rapid camera updates');
    parity.setCamera(undefined);
    for (let i = 0; i < 20; i++) {
      parity.setRegion(regionAt(30 + i / 10));
      await sleep(20);
    }
    await wait(() => longitudeIs(31.9));
    await idle('rapid region updates');
    passed.push(
      '20 rapid camera and 20 rapid region updates settle at latest values',
    );

    for (const kind of ['camera', 'region']) {
      map.animateCamera(
        { center: { latitude: 20, longitude: 80 } },
        { duration: 2000 },
      );
      await sleep(150);
      if (kind === 'camera') parity.setCamera(cameraAt(45));
      else {
        parity.setCamera(undefined);
        parity.setRegion(regionAt(35));
      }
      await wait(() => longitudeIs(kind === 'camera' ? 45 : 35));
      await sleep(2100);
      check(
        await longitudeIs(kind === 'camera' ? 45 : 35),
        kind + ' did not interrupt animation',
      );
      await idle(kind + ' interruption');
    }
    passed.push(
      'changed camera and region interrupt active animation without stale completion restoring target',
    );

    parity.setCamera(undefined);
    for (const mode of ['change', 'complete']) {
      parity.setRegionFeedback(mode);
      const before = counts();
      await map.animateToRegion(regionAt(mode === 'change' ? 36 : 37), 400);
      await wait(() => longitudeIs(mode === 'change' ? 36 : 37));
      await idle(mode + ' callback feedback');
      const after = counts();
      check(
        after.completions - before.completions === 1,
        mode + ' callback feedback caused duplicate completions',
      );
      check(
        after.feedback > before.feedback,
        mode + ' callback feedback was not exercised',
      );
      check(
        after.changes - before.changes < 120,
        mode + ' callback feedback caused event amplification',
      );
      parity.setRegionFeedback('off');
    }
    passed.push(
      'change/complete callbacks feed reordered regions into state: one completion and stable idle',
    );
    parity.setRegion(undefined);
    await sleep(100);
    await map.setCamera({ center: { latitude: 20, longitude: 38 } });
    await idle('released control');
    check(await longitudeIs(38), 'released control reset the viewport');
    passed.push('removing controlled props preserves imperative control');
    check(
      api.snapshot().errors.length === 0,
      'native errors during controlled-camera acceptance',
    );
    return {
      platform: api.snapshot().platform,
      passed,
      regionCounts: counts(),
      camera: await map.getCamera(),
    };
  } finally {
    parity.setRegionFeedback('off');
    parity.setCamera(undefined);
    parity.setRegion(undefined);
  }
}
