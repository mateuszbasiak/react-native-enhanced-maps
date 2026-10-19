import { existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { readLocalMapsConfig } from './local-config.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const input = path.join(root, '.env.local');
const keys = readLocalMapsConfig(existsSync(input) ? readFileSync(input, 'utf8') : '', process.env);
const outputs = [
  ['example/ios/Config/Maps.local.xcconfig', `// Generated locally. Do not commit.\nGOOGLE_MAPS_IOS_API_KEY = ${keys.GOOGLE_MAPS_IOS_API_KEY}\n`],
  ['example/android/maps.local.properties', `# Generated locally. Do not commit.\nGOOGLE_MAPS_ANDROID_API_KEY=${keys.GOOGLE_MAPS_ANDROID_API_KEY}\n`],
];
for (const [relative, content] of outputs) {
  const output = path.join(root, relative);
  mkdirSync(path.dirname(output), { recursive: true });
  writeFileSync(output, content, { mode: 0o600 });
  chmodSync(output, 0o600);
}
console.log(JSON.stringify({ iosKeyConfigured: Boolean(keys.GOOGLE_MAPS_IOS_API_KEY), androidKeyConfigured: Boolean(keys.GOOGLE_MAPS_ANDROID_API_KEY) }));
