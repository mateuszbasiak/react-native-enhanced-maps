import test from 'node:test';
import assert from 'node:assert/strict';
const load = () => import('../packages/maps/lib/markerAccessibility.js');

test('selection-only labelled markers expose one button target', async () => {
  const { markerAccessibility } = await load();
  const result = markerAccessibility(
    { accessibilityLabel: 'Boat', onSelect() {} },
    { hasCustomContent: false, hasCallout: false, selected: false, id: 'boat' },
  );
  assert.equal(result.wrapper.accessible, false);
  assert.equal(result.content.accessible, true);
  assert.equal(result.content.accessibilityRole, 'button');
  assert.equal(result.content.accessibilityLabel, 'Boat');
});

test('custom child controls remain independently accessible unless grouped explicitly', async () => {
  const { markerAccessibility } = await load();
  const context = {
    hasCustomContent: true,
    hasCallout: false,
    selected: false,
    id: 'boat',
  };
  for (const props of [{}, { onPress() {} }, { onSelect() {} }]) {
    const result = markerAccessibility(props, context);
    assert.equal(result.wrapper.accessible, false);
    assert.equal(result.content.accessible, false);
  }
  const grouped = markerAccessibility(
    { accessible: true, onPress() {}, title: 'Boat' },
    context,
  );
  assert.equal(grouped.wrapper.accessible, false);
  assert.equal(grouped.content.accessible, true);
  assert.equal(grouped.content.accessibilityLabel, 'Boat');
  const optOut = markerAccessibility(
    { accessible: false, accessibilityLabel: 'Boat', onPress() {} },
    context,
  );
  assert.equal(optOut.content.accessible, false);
});

test('static markers have one label target and default pins have a useful fallback', async () => {
  const { markerAccessibility } = await load();
  const context = {
    hasCustomContent: false,
    hasCallout: false,
    selected: false,
    id: 'generated-id',
  };
  const result = markerAccessibility({}, context);
  assert.equal(result.wrapper.accessible, true);
  assert.equal(result.wrapper.accessibilityLabel, 'Map marker');
  assert.equal(result.content.accessible, false);
  assert.equal(
    markerAccessibility(
      { accessibilityLabel: 'Buoy' },
      { ...context, hasCustomContent: true },
    ).wrapper.accessibilityLabel,
    'Buoy',
  );
});

test('hints and action callbacks reach the target and real callout state wins', async () => {
  const { markerAccessibility } = await load();
  const calls = [];
  const props = {
    accessibilityHint: 'Open details',
    accessibilityActions: [{ name: 'inspect', label: 'Inspect boat' }],
    onAccessibilityAction: (event) => calls.push(event.nativeEvent.actionName),
    accessibilityState: { busy: true, expanded: false },
    accessibilityRole: 'imagebutton',
  };
  const result = markerAccessibility(props, {
    hasCustomContent: false,
    hasCallout: true,
    selected: true,
    id: 'boat',
  });
  assert.equal(result.content.accessibilityHint, props.accessibilityHint);
  assert.equal(result.content.accessibilityActions, props.accessibilityActions);
  assert.equal(result.content.accessibilityRole, 'imagebutton');
  assert.deepEqual(result.content.accessibilityState, {
    busy: true,
    expanded: true,
  });
  result.content.onAccessibilityAction({
    nativeEvent: { actionName: 'inspect' },
  });
  assert.deepEqual(calls, ['inspect']);
  assert.deepEqual(props.accessibilityState, { busy: true, expanded: false });
});
