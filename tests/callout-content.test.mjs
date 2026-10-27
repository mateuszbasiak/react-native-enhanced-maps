import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
const load = () => import('../packages/maps/lib/calloutContent.js');
const Callout = () => null;

test('extracts one callout through fragments without changing marker controls', async () => {
  const { extractCallout } = await load();
  const pin = React.createElement('pin', { key: 'pin' });
  const bubble = React.createElement(Callout, { tooltip: true }, 'Details');
  const result = extractCallout(
    React.createElement(
      React.Fragment,
      {},
      pin,
      React.createElement(React.Fragment, {}, bubble),
    ),
    Callout,
  );
  assert.equal(result.content.length, 1);
  assert.equal(result.content[0].type, React.Fragment);
  assert.equal(result.contentCount, 1);
  assert.equal(result.callout.props.tooltip, true);
  assert.equal(result.callout.props.children, 'Details');
  assert.throws(() => extractCallout([bubble, bubble], Callout), /one Callout/);
});

test('bubble attachment follows the pin anchor and layout, not bubble dimensions', async () => {
  const { calloutOffset } = await load();
  assert.deepEqual(
    calloutOffset({ width: 24, height: 32 }, { x: 0.5, y: 1 }, { x: 0, y: 0 }),
    { x: 0, y: -32 },
  );
  assert.deepEqual(
    calloutOffset(
      { width: 80, height: 40 },
      { x: 0.25, y: 0.5 },
      { x: 5, y: 7 },
      { x: 1, y: 0.25 },
      { x: 3, y: -4 },
    ),
    { x: 68, y: -7 },
  );
  for (const bad of [
    { x: NaN, y: 0 },
    { x: 0, y: Infinity },
  ])
    assert.throws(() =>
      calloutOffset(
        { width: 20, height: 30 },
        { x: 0.5, y: 1 },
        { x: 0, y: 0 },
        bad,
      ),
    );
});

test('title and description are validated without coercion', async () => {
  const { calloutText } = await load();
  assert.deepEqual(calloutText({ title: 'Boat', description: 'Moored' }), {
    title: 'Boat',
    description: 'Moored',
  });
  assert.deepEqual(calloutText({}), {});
  for (const value of [1, null, {}, 'x'.repeat(4097)])
    assert.throws(() => calloutText({ title: value }));
});

test('extracting descriptors preserves independently keyed fragment scopes', async () => {
  const { extractCallout } = await load();
  const group = (id) =>
    React.createElement(
      React.Fragment,
      { key: id },
      React.createElement('pin', { key: 'same', value: id }),
    );
  const first = extractCallout([group('a'), group('b')], Callout);
  assert.equal(first.content[0].type, React.Fragment);
  assert.equal(first.content[1].type, React.Fragment);
  assert.notEqual(first.content[0].key, first.content[1].key);
  const reordered = extractCallout([group('b'), group('a')], Callout);
  assert.equal(reordered.content[1].key, first.content[0].key);
  const child = extractCallout(React.createElement('pin'), Callout).content[0];
  assert.notEqual(child.key, null, 'array children need a stable React key');
});
