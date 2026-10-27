/** Self-contained function evaluated inside the Debug example's Hermes runtime. */
export async function runFeatureChecks() {
  const check = (value, message) => {
    if (!value) throw new Error(message);
  };
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const wait = async (predicate) => {
    for (let i = 0; i < 150; i++) {
      if (await predicate()) return;
      await sleep(100);
    }
    throw new Error('Feature runtime check timed out');
  };
  await wait(() => globalThis.__enhancedMapsScenarios);
  const previous = globalThis.__enhancedMapsVerification;
  globalThis.__enhancedMapsScenarios.select('runtime');
  await wait(
    () =>
      globalThis.__enhancedMapsVerification &&
      globalThis.__enhancedMapsVerification !== previous &&
      globalThis.__enhancedMapsVerification.snapshot().readyCount > 0,
  );
  const api = globalThis.__enhancedMapsVerification,
    parity = api.parity,
    m = parity.map();
  parity.showMarkers(true);
  parity.setUserLocation({
    latitude: 54.37,
    longitude: 18.66,
    accuracy: 8,
    heading: 90,
    timestamp: Date.now(),
  });
  parity.setLocationFlags({
    showsUserLocation: true,
    followsUserLocation: true,
  });
  await wait(() => parity.featureSnapshot().locations.length > 0);
  await wait(
    async () =>
      Math.abs((await m.getCamera()).center.longitude - 18.66) < 0.0001,
  );
  parity.setUserLocation({
    latitude: 54.371,
    longitude: 18.662,
    accuracy: 6,
    timestamp: Date.now(),
  });
  await wait(
    async () =>
      Math.abs((await m.getCamera()).center.longitude - 18.662) < 0.0001,
  );
  check(
    parity.featureSnapshot().locations.length >= 2,
    'Supplied location updates did not emit events',
  );
  parity.setCamera({
    center: { latitude: 54.37, longitude: 18.67 },
    zoom: 13,
    heading: 0,
    pitch: 0,
  });
  await wait(
    async () =>
      Math.abs((await m.getCamera()).center.longitude - 18.67) < 0.0001,
  );
  parity.setUserLocation({ latitude: 54.372, longitude: 18.664 });
  await sleep(500);
  check(
    Math.abs((await m.getCamera()).center.longitude - 18.67) < 0.0001,
    'Follow overrode controlled camera',
  );
  parity.setCamera(undefined);
  await wait(
    async () =>
      Math.abs((await m.getCamera()).center.longitude - 18.664) < 0.0001,
  );
  parity.setLocationFlags({
    showsUserLocation: true,
    followsUserLocation: false,
  });
  await m.setCamera({
    center: { latitude: 54.37, longitude: 18.66 },
    zoom: 13,
    heading: 0,
    pitch: 0,
  });
  await sleep(300);
  const png = await m.takeSnapshot({
    width: 320,
    height: 240,
    result: 'base64',
  });
  check(png.startsWith('iVBORw0KGgo'), 'PNG snapshot signature missing');
  const jpg = await m.takeSnapshot({
    width: 320,
    height: 240,
    format: 'jpg',
    quality: 0.8,
    result: 'base64',
  });
  check(jpg.startsWith('/9j/'), 'JPEG snapshot signature missing');
  const file = await m.takeSnapshot({
    width: 512,
    height: 384,
    result: 'file',
  });
  check(
    file.startsWith('file://') && file.endsWith('.png'),
    'File snapshot URI missing',
  );
  let rejected = false;
  try {
    await m.takeSnapshot({ width: 0 });
  } catch {
    rejected = true;
  }
  check(rejected, 'Invalid snapshot dimensions accepted');
  parity.setUserLocation({ latitude: 0, longitude: 100 });
  await sleep(300);
  await m.fitToElements({ animated: false });
  check(
    Math.abs((await m.getCamera()).center.longitude - 18.66) < 1,
    'User location polluted marker fitting',
  );
  parity.setUserLocation(null);
  parity.setLocationFlags({
    showsUserLocation: true,
    followsUserLocation: false,
  });
  const count = parity.featureSnapshot().locations.length;
  await sleep(300);
  check(
    parity.featureSnapshot().locations.length === count,
    'Explicit null started a native watcher',
  );
  check(
    api.snapshot().errors.length === 0,
    'Unexpected native error: ' + JSON.stringify(api.snapshot().errors),
  );
  return {
    platform: api.snapshot().platform,
    passed: [
      'supplied fixes and location events',
      'location camera following',
      'controlled camera ownership',
      'follow resumes after controlled release',
      'PNG base64 export',
      'JPEG base64 export',
      'file export',
      'invalid snapshot rejection',
      'null location disables watcher',
      'user location excluded from marker fitting',
    ],
    snapshotFile: file,
    pngBase64Length: png.length,
    jpgBase64Length: jpg.length,
    locationEvents: count,
  };
}
