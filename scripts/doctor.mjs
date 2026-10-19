import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
function probe(command, args) {
  const result = spawnSync(command, args, { encoding: 'utf8', timeout: 10000 });
  return { available: result.status === 0, version: (result.stdout || result.stderr || result.error?.message || '').trim().split('\n').slice(0, 3).join('\n') };
}
const report = {
  schemaVersion: 1,
  node: process.version,
  platform: process.platform,
  tools: { npm: probe('npm', ['--version']), xcode: probe('xcodebuild', ['-version']), java: probe('java', ['-version']), adb: probe('adb', ['version']), cocoapods: probe('pod', ['--version']) },
  credentials: Object.fromEntries(['GOOGLE_MAPS_IOS_API_KEY', 'GOOGLE_MAPS_ANDROID_API_KEY'].map(name => [name, Boolean(process.env[name])])),
  note: 'Credential presence only; validity and physical-device availability are not established.',
};
mkdirSync('artifacts', { recursive: true });
writeFileSync('artifacts/doctor.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
