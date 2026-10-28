import { test } from 'node:test';
import assert from 'node:assert/strict';
const tiles = await import('../packages/maps/lib/rnTiles.js').catch(() => ({}));
test('WMSTile translates RN Maps Web Mercator placeholders to native WMS bounds', () => {
  assert.equal(typeof tiles.normalizeWMSTile, 'function');
  const tile = tiles.normalizeWMSTile({
    urlTemplate:
      'https://example.com/wms?bbox={minX},{minY},{maxX},{maxY}&width={width}&height={height}',
    tileSize: 512,
  });
  assert.equal(
    tile.urlTemplate,
    'https://example.com/wms?bbox={bbox-epsg-3857}&width=512&height=512',
  );
  assert.equal(tile.tileKind, 'wms');
  assert.throws(
    () =>
      tiles.normalizeWMSTile({
        urlTemplate: 'https://example.com/wms?x={minX}',
      }),
    /bbox|bound/i,
  );
});
test('LocalTile uses native filesystem and Android asset schemes without network URLs', () => {
  assert.equal(typeof tiles.normalizeLocalTile, 'function');
  assert.equal(
    tiles.normalizeLocalTile({ pathTemplate: '/data/map/{z}/{x}/{y}.png' })
      .urlTemplate,
    'file:///data/map/{z}/{x}/{y}.png',
  );
  assert.equal(
    tiles.normalizeLocalTile({
      pathTemplate: 'maps/{z}/{x}/{y}.png',
      useAssets: true,
    }).urlTemplate,
    'asset://maps/{z}/{x}/{y}.png',
  );
  for (const pathTemplate of [
    'https://example.com/{z}/{x}/{y}.png',
    '../{z}/{x}/{y}.png',
    'file://host/{z}/{x}/{y}.png',
  ])
    assert.throws(() => tiles.normalizeLocalTile({ pathTemplate }));
  assert.throws(() =>
    tiles.normalizeLocalTile({
      pathTemplate: '../maps/{z}/{x}/{y}.png',
      useAssets: true,
    }),
  );
});

test('LocalTile preserves file URI escapes while escaping literal filesystem percent signs', () => {
  const file = 'file:///app/my%20tiles/{z}/{x}/{y}.png';
  assert.equal(
    tiles.normalizeLocalTile({ pathTemplate: file }).urlTemplate,
    file,
  );
  assert.equal(
    tiles.normalizeLocalTile({
      pathTemplate: '/app/my%20tiles/{z}/{x}/{y}.png',
    }).urlTemplate,
    'file:///app/my%2520tiles/{z}/{x}/{y}.png',
  );
  assert.throws(() =>
    tiles.normalizeLocalTile({
      pathTemplate: 'file:///app/%xx/{z}/{x}/{y}.png',
    }),
  );
});
