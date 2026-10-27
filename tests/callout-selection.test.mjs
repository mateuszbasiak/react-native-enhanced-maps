import { test } from 'node:test';
import assert from 'node:assert/strict';

const load = () => import('../packages/maps/lib/calloutSelection.js');

test('one callout per map, stable snapshots and ordered selection callbacks', async () => {
  const { createCalloutSelection } = await load();
  const map = createCalloutSelection();
  const a = {},
    b = {},
    events = [];
  map.register('a', a, {
    select: () => events.push('a+'),
    deselect: (reason) => events.push(`a-${reason}`),
  });
  map.register('b', b, {
    select: () => events.push('b+'),
    deselect: (reason) => events.push(`b-${reason}`),
  });
  map.show('a', a);
  assert.equal(map.getSnapshot(), null, 'not ready');
  map.activate();
  map.show('a', a);
  const snapshot = map.getSnapshot();
  assert.equal(snapshot.id, 'a');
  assert.equal(snapshot.owner, a);
  map.show('a', a);
  assert.equal(map.getSnapshot(), snapshot);
  map.show('b', b);
  assert.deepEqual(events, ['a+', 'a-selection', 'b+']);
  map.hide('a', a);
  assert.equal(
    map.getSnapshot().id,
    'b',
    'old marker cannot hide another callout',
  );
  map.hide('b', b);
  assert.deepEqual(events, ['a+', 'a-selection', 'b+', 'b-hide']);
  assert.equal(map.getSnapshot(), null);
});

test('replaced registrations and stale cleanup cannot control the current owner', async () => {
  const { createCalloutSelection } = await load();
  const map = createCalloutSelection();
  map.activate();
  const old = {},
    current = {},
    events = [];
  const staleCleanup = map.register('boat', old, {
    select() {},
    deselect: (reason) => events.push(reason),
  });
  map.show('boat', old);
  map.register('boat', current, {
    select() {},
    deselect: (reason) => events.push('current:' + reason),
  });
  assert.deepEqual(events, ['unmount']);
  staleCleanup();
  map.show('boat', old);
  assert.equal(map.getSnapshot(), null);
  map.show('boat', current);
  staleCleanup();
  assert.equal(map.getSnapshot().owner, current);
  map.deactivate('style');
  assert.equal(map.getSnapshot(), null);
  map.show('boat', current);
  assert.equal(map.getSnapshot(), null);
  map.activate();
  map.show('boat', current);
  assert.equal(map.getSnapshot().owner, current);
});

test('reentrant deselection cannot select a superseded target or erase a newer selection', async () => {
  const { createCalloutSelection } = await load();
  const map = createCalloutSelection();
  map.activate();
  const a = {},
    b = {},
    c = {},
    events = [];
  map.register('a', a, {
    select: () => events.push('a+'),
    deselect: () => {
      events.push('a-');
      map.show('c', c);
    },
  });
  map.register('b', b, {
    select: () => events.push('b+'),
    deselect: () => events.push('b-'),
  });
  map.register('c', c, {
    select: () => events.push('c+'),
    deselect: () => events.push('c-'),
  });
  map.show('a', a);
  map.show('b', b);
  assert.equal(map.getSnapshot().id, 'c');
  assert.deepEqual(events, ['a+', 'a-', 'c+']);
});

test('cleanup, map isolation and subscriptions retain no stale selection', async () => {
  const { createCalloutSelection } = await load();
  const first = createCalloutSelection(),
    second = createCalloutSelection();
  first.activate();
  second.activate();
  const owner = {};
  let notifications = 0,
    deselections = 0;
  const unsubscribe = first.subscribe(() => notifications++);
  const cleanup = first.register('a', owner, {
    select() {},
    deselect() {
      deselections++;
    },
  });
  second.register('a', owner, { select() {}, deselect() {} });
  first.show('a', owner);
  assert.equal(second.getSnapshot(), null);
  first.show('a', owner);
  assert.equal(notifications, 1);
  cleanup();
  cleanup();
  assert.equal(first.getSnapshot(), null);
  assert.equal(deselections, 1);
  assert.equal(notifications, 2);
  unsubscribe();
  first.reset('map-press');
  assert.equal(notifications, 2);
});

test('callback failure leaves a consistent snapshot and later actions usable', async () => {
  const { createCalloutSelection } = await load();
  const map = createCalloutSelection();
  map.activate();
  const a = {},
    b = {};
  let selectedB = 0,
    notifications = 0;
  map.subscribe(() => notifications++);
  map.register('a', a, {
    select() {},
    deselect() {
      throw new Error('application callback');
    },
  });
  map.register('b', b, {
    select() {
      selectedB++;
    },
    deselect() {},
  });
  map.show('a', a);
  assert.throws(() => map.show('b', b), /application callback/);
  assert.equal(map.getSnapshot().id, 'b');
  assert.equal(selectedB, 1);
  assert.equal(notifications, 2);
  map.hide('b', b);
  assert.equal(map.getSnapshot(), null);
});
