import { test } from 'node:test';
import assert from 'node:assert/strict';
const load = () => import('../packages/maps/lib/markerDrag.js');
const event = (phase, session = 1, revision = 2) => ({
  phase,
  session,
  revision,
  latitude: 54,
  longitude: 18,
});
test('marker drag events require a current start and terminate once', async () => {
  const { createMarkerDragGate } = await load();
  const gate = createMarkerDragGate();
  assert.equal(gate.accept(event('update'), 2, true), null);
  assert.equal(gate.accept(event('start'), 1, true), null);
  assert.equal(gate.accept(event('start'), 2, false), null);
  assert.equal(gate.accept(event('start'), 2, true).phase, 'start');
  assert.equal(gate.accept(event('update', 2), 2, true), null);
  assert.equal(gate.accept(event('update'), 2, true).phase, 'update');
  assert.equal(gate.accept(event('end'), 2, true).phase, 'end');
  assert.equal(gate.accept(event('end'), 2, true), null);
});
test('disable and revision changes suppress moves but allow one cancellation', async () => {
  const { createMarkerDragGate } = await load();
  const gate = createMarkerDragGate();
  gate.accept(event('start'), 2, true);
  assert.equal(gate.accept(event('update'), 3, false), null);
  assert.equal(gate.accept(event('cancel'), 3, false).phase, 'cancel');
  assert.equal(gate.accept(event('cancel'), 3, false), null);
});
test('drag payloads validate coordinates and cleanup restores prop coordinates', async () => {
  const { createMarkerDragGate } = await load();
  const gate = createMarkerDragGate();
  for (const bad of [
    null,
    {},
    event('bad'),
    { ...event('start'), latitude: NaN },
    { ...event('start'), longitude: 181 },
    { ...event('start'), session: 0 },
  ])
    assert.equal(gate.accept(bad, 2, true), null);
  gate.accept(event('start'), 2, true);
  assert.deepEqual(gate.cancel({ latitude: 1, longitude: 2 }), {
    phase: 'cancel',
    coordinate: { latitude: 1, longitude: 2 },
  });
  assert.equal(gate.cancel({ latitude: 1, longitude: 2 }), null);
});

test('completed sessions cannot restart from a delayed native start', async () => {
  const { createMarkerDragGate } = await load();
  const gate = createMarkerDragGate();
  gate.accept(event('start'), 2, true);
  gate.accept(event('end'), 2, true);
  assert.equal(gate.accept(event('start'), 2, true), null);
  assert.equal(gate.accept(event('start', 2), 2, true).phase, 'start');
});

test('press coordinates retain successful native drag endpoints across unchanged prop rerenders', async () => {
  const { createMarkerDragGate } = await load();
  const gate = createMarkerDragGate();
  const initial = { latitude: 54, longitude: 18 };
  const endpoint = { latitude: 54.1, longitude: 18.2 };
  gate.syncCoordinate(initial);
  gate.accept(event('start'), 2, true);
  gate.accept({ ...event('end'), ...endpoint }, 2, true);
  assert.deepEqual(gate.syncCoordinate({ ...initial }), endpoint);
  assert.deepEqual(gate.syncCoordinate({ latitude: 55, longitude: 19 }), {
    latitude: 55,
    longitude: 19,
  });
});

test('coordinate echoes do not override active native motion and cancellation restores coordinates', async () => {
  const { createMarkerDragGate } = await load();
  const gate = createMarkerDragGate();
  gate.syncCoordinate({ latitude: 54, longitude: 18 });
  gate.accept(event('start'), 2, true);
  const moved = { latitude: 54.2, longitude: 18.3 };
  gate.accept({ ...event('update'), ...moved }, 2, true);
  assert.deepEqual(
    gate.syncCoordinate({ latitude: 54.1, longitude: 18.2 }),
    moved,
  );
  const restored = { latitude: 54.1, longitude: 18.2 };
  gate.accept({ ...event('cancel'), ...restored }, 3, false);
  assert.deepEqual(gate.syncCoordinate(restored), restored);
});
