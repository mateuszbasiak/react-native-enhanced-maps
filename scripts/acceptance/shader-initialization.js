// Evaluate in the Debug example runtime after selecting shader-lifecycle and
// explicitly enabling software adapters when needed. Results are bounded and
// available at globalThis.__gpuInitializationRun; this is not a readiness probe.
(() => {
  if (globalThis.__gpuInitializationRun?.running)
    throw Error('Initialization acceptance is already running');
  const api = globalThis.__enhancedMapsShaderLifecycle;
  if (!api) throw Error('Select a fresh shader-lifecycle scenario first');
  const result = (globalThis.__gpuInitializationRun = {
    running: true,
    cycles: 0,
    records: [],
    failure: null,
  });
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const wait = async (test, label) => {
    const end = Date.now() + 15000;
    while (!test()) {
      if (Date.now() > end) throw Error('Timeout ' + label);
      await sleep(20);
    }
  };
  (async () => {
    let registry, wrapped;
    try {
      await wait(() => {
        const s = api.snapshot();
        return (
          s.software &&
          s.maps.a.mounted &&
          s.maps.b.mounted &&
          s.ready &&
          s.diagnostics.pools === 2
        );
      }, 'initial ready');
      result.before = api.snapshot();
      api.mounted('a', false);
      await wait(() => {
        const s = api.snapshot();
        return !s.maps.a.mounted && s.ready && s.diagnostics.pools === 1;
      }, 'remove A');
      for (let cycle = 0; cycle < 100; cycle++) {
        const baseline = api.snapshot();
        registry = globalThis.__enhancedMapsShaderRecovery;
        if (!(registry instanceof Map))
          throw Error('Missing device-lease registry');
        const original = registry.set;
        let hit = null;
        wrapped = function (id, callback) {
          original.call(this, id, callback);
          if (id === 'lifecycle-a') {
            delete this.set;
            hit = api.snapshot();
            api.mounted('a', false);
          }
          return this;
        };
        registry.set = wrapped;
        api.mounted('a', true);
        await wait(() => hit !== null, 'device-acquired hook');
        await wait(() => {
          const s = api.snapshot();
          return (
            !s.maps.a.mounted &&
            !registry.has('lifecycle-a') &&
            s.ready &&
            s.diagnostics.pools === 1
          );
        }, 'interrupted cleanup');
        const after = api.snapshot();
        const pass =
          hit.maps.a.mounted &&
          hit.maps.a.epoch > baseline.maps.a.epoch &&
          hit.maps.a.readyEpoch !== hit.maps.a.epoch &&
          after.maps.a.readyCount === baseline.maps.a.readyCount &&
          after.maps.b.epoch === baseline.maps.b.epoch &&
          after.maps.b.readyCount === baseline.maps.b.readyCount &&
          after.maps.b.probe.frames >= baseline.maps.b.probe.frames &&
          after.errors.length === 0;
        if (!pass) throw Error('Interruption assertion failed ' + cycle);
        result.records.push({
          cycle,
          epoch: hit.maps.a.epoch,
          readyCount: after.maps.a.readyCount,
          pools: after.diagnostics.pools,
          bFrames: after.maps.b.probe.frames,
        });
        result.cycles++;
      }
      api.mounted('a', true);
      await wait(() => {
        const s = api.snapshot();
        return (
          s.maps.a.mounted &&
          s.maps.b.mounted &&
          s.ready &&
          s.diagnostics.pools === 2
        );
      }, 'restore A');
      result.final = api.snapshot();
      if (
        !api.clock(
          result.before.maps.b.probe,
          result.final.maps.b.probe,
          'running',
        ).pass
      )
        throw Error('Map B stopped advancing');
    } catch (error) {
      result.failure = String(error);
      try {
        result.final = api.snapshot();
      } catch (snapshotError) {
        result.snapshotFailure = String(snapshotError);
      }
    } finally {
      if (registry?.set === wrapped) delete registry.set;
      result.running = false;
    }
  })();
  return 'initialization interruption started';
})();
