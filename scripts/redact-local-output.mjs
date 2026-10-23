// Build tools may print expanded user-defined settings. Redact local map keys
// before their output reaches either the terminal or captured verification logs.
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { collectLocalMapsSecrets, redactLocalText } from './local-config.mjs';
const keys = collectLocalMapsSecrets(
  fileURLToPath(new URL('../', import.meta.url)),
  process.env,
);
const args = process.argv.slice(2);
if (args[0] === '--') args.shift();
const command = args.shift();
if (!command) throw new Error('Expected a command after --');
const child = spawn(command, args, { stdio: ['inherit', 'pipe', 'pipe'] });
const redact = (text) => redactLocalText(text, keys);
for (const [source, destination] of [
  [child.stdout, process.stdout],
  [child.stderr, process.stderr],
]) {
  let pending = '';
  source.setEncoding('utf8');
  source.on('data', (chunk) => {
    pending += chunk;
    const lines = pending.split('\n');
    pending = lines.pop();
    for (const line of lines) destination.write(redact(line) + '\n');
  });
  source.on('end', () => {
    if (pending) destination.write(redact(pending));
  });
}
child.on('error', () => {
  console.error('Native command could not start');
  process.exitCode = 1;
});
child.on('close', (code) => {
  process.exitCode = code ?? 1;
});
