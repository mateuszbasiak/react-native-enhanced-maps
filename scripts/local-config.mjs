import { parseEnv } from 'node:util';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export function readLocalMapsConfig(text, environment = {}) {
  const local = parseEnv(text);
  return Object.fromEntries(
    ['GOOGLE_MAPS_IOS_API_KEY', 'GOOGLE_MAPS_ANDROID_API_KEY'].map((name) => {
      const value = environment[name] ?? local[name] ?? '';
      if (value && !/^[A-Za-z0-9_-]+$/.test(value))
        throw new Error(
          `${name} contains invalid characters; key value omitted`,
        );
      return [name, value];
    }),
  );
}

export function collectLocalMapsSecrets(root, environment = {}) {
  const files = [
    '.env.local',
    'example/ios/Config/Maps.local.xcconfig',
    'example/android/maps.local.properties',
  ];
  const values = Object.values(readLocalMapsConfig('', environment));
  for (const file of files) {
    const path = join(root, file);
    if (existsSync(path))
      values.push(
        ...Object.values(readLocalMapsConfig(readFileSync(path, 'utf8'))),
      );
  }
  return [...new Set(values.filter(Boolean))].sort(
    (a, b) => b.length - a.length,
  );
}

export function redactLocalText(text, secrets) {
  return secrets.reduce(
    (result, key) => result.split(key).join('[REDACTED]'),
    text,
  );
}
