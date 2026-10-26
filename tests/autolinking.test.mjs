import assert from 'node:assert/strict';
import { test } from 'node:test';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

test('native maps are discoverable on both platforms by a consumer CLI', () => {
  const config = JSON.parse(
    execFileSync(
      process.execPath,
      [path.resolve('node_modules/react-native/cli.js'), 'config'],
      { cwd: 'example', encoding: 'utf8' },
    ),
  );
  const maps = config.dependencies['react-native-maplibre-maps'];
  assert(
    maps,
    'CLI must discover maps rather than silently omitting the native dependency',
  );
  assert(maps.platforms.ios?.podspecPath);
  assert(maps.platforms.android?.sourceDir);
  assert.match(maps.platforms.android.packageImportPath, /EnhancedMapsPackage/);
});
