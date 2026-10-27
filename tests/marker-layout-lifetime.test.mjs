import { test } from 'node:test';
import assert from 'node:assert/strict';
test('cluster layout never crosses the render-phase marker signature handover', async () => {
  const { currentMarkerLayout } =
    await import('../packages/maps/lib/markerLayoutLifetime.js');
  const layout = {
    sourceRevision: 1,
    indexRevision: 7,
    features: [
      {
        id: 'em-cluster:14',
        sourceId: 'em-marker-clusters',
        clusterId: 14,
        count: 2,
        latitude: 54,
        longitude: 18,
      },
    ],
  };
  const accepted = { styleRevision: 3, layout };
  const version = { signature: 'clustered-boats', revision: 1 };
  assert.equal(
    currentMarkerLayout(accepted, 3, version, 'clustered-boats'),
    layout,
  );
  // React schedules the new version during render; this render still sees revision1.
  // Group lookup must not use the old cluster when the new content has no groups.
  assert.equal(
    currentMarkerLayout(accepted, 3, version, 'unclustered-boats'),
    undefined,
  );
  assert.equal(
    currentMarkerLayout(accepted, 3, version, 'different-groups'),
    undefined,
  );
  assert.equal(
    currentMarkerLayout(accepted, 4, version, 'clustered-boats'),
    undefined,
  );
  const next = { signature: 'unclustered-boats', revision: 2 };
  assert.equal(
    currentMarkerLayout(accepted, 3, next, 'unclustered-boats'),
    undefined,
  );
  const updated = {
    styleRevision: 3,
    layout: { ...layout, sourceRevision: 2, features: [] },
  };
  assert.equal(
    currentMarkerLayout(updated, 3, next, 'unclustered-boats'),
    updated.layout,
  );
  assert.equal(
    currentMarkerLayout(undefined, 3, next, 'unclustered-boats'),
    undefined,
  );
});
