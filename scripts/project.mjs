import { spawnSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanTargets, projectCommand } from './project-commands.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const [action, ...input] = process.argv.slice(2);
const dryRun = input.includes('--dry-run');
const args = input.filter((arg) => arg !== '--dry-run');
try {
  if (action === 'clean') {
    if (args.length) throw new Error('clean accepts only --dry-run');
    for (const target of cleanTargets) {
      console.log(`${dryRun ? 'Would remove' : 'Removing'} ${target}`);
      if (!dryRun)
        rmSync(path.join(root, target), { recursive: true, force: true });
    }
  } else {
    const steps = projectCommand(action, args, { root });
    if (dryRun) console.log(JSON.stringify(steps, null, 2));
    else
      for (const step of steps) {
        // Build tools may expand credentials. All subprocess output goes through
        // the same redactor used for native verification, including forwarded args.
        const result = spawnSync(
          process.execPath,
          [
            path.join(root, 'scripts/redact-local-output.mjs'),
            '--',
            step.command,
            ...step.args,
          ],
          {
            cwd: step.cwd,
            env: { ...process.env, ...step.env },
            stdio: 'inherit',
          },
        );
        if (result.error) throw new Error('Could not start project command');
        if (result.status !== 0) {
          process.exitCode = result.status ?? 1;
          break;
        }
      }
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
