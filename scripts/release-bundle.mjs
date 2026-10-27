import assert from 'node:assert/strict';

// Reserved package/example globals. The shader handle is runtime transport, not
// a development diagnostic API. Do not print bundle excerpts on failure.
export function assertReleaseBundle(bundle, secrets = []) {
  assert(
    secrets.every((secret) => !secret || !bundle.includes(secret)),
    'Configured maps secret present in production bundle',
  );
  const globals = bundle.match(/__enhancedMaps[\w$]*/g) ?? [];
  assert(
    globals.every((name) => name === '__enhancedMapsShader'),
    'Development maps globals present in production bundle',
  );
}
