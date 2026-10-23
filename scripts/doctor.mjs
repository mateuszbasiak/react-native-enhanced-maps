import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
function probe(command, args) {
  const result = spawnSync(command, args, { encoding: 'utf8', timeout: 10000 });
  return {
    available: result.status === 0,
    version: (result.stdout || result.stderr || result.error?.message || '')
      .trim()
      .split('\n')
      .slice(0, 3)
      .join('\n'),
  };
}
const report = {
  schemaVersion: 1,
  node: process.version,
  platform: process.platform,
  tools: {
    npm: probe('npm', ['--version']),
    xcode: probe('xcodebuild', ['-version']),
    java: probe('java', ['-version']),
    adb: probe('adb', ['version']),
    cocoapods: probe('pod', ['--version']),
  },
  note: 'Tool availability only; native builds and device behavior require separate verification.',
};
mkdirSync('artifacts', { recursive: true });
writeFileSync('artifacts/doctor.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
