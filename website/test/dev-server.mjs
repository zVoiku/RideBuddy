/**
 * `wrangler dev` for the tests: the real Workers runtime serving website/dist
 * plus the Worker, with a throwaway local D1. Run from the repository root,
 * where wrangler.jsonc lives. Needs a built dist/ (npm run build).
 */
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** @returns {Promise<{base: string, stop: () => Promise<void>}>} */
export async function startDev({ port, password }) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'rb-d1-'));
  const args = ['--yes', 'wrangler@4', 'dev', '--ip', '127.0.0.1', '--port', String(port), '--persist-to', dir];
  if (password) args.push('--var', `ADMIN_PASSWORD:${password}`);
  const proc = spawn('npx', args, {
    cwd: ROOT, detached: true, stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, WRANGLER_SEND_METRICS: 'false' },
  });
  let log = '';
  proc.stdout.on('data', (d) => { log += d; });
  proc.stderr.on('data', (d) => { log += d; });
  const base = `http://127.0.0.1:${port}`;
  const stop = async () => {
    try { process.kill(-proc.pid, 'SIGTERM'); } catch { /* already gone */ }
    await sleep(500);
    await rm(dir, { recursive: true, force: true });
  };
  for (let i = 0; i < 120; i += 1) {
    if (/ERROR/.test(log)) break;
    try {
      if ((await fetch(`${base}/`)).ok) return { base, stop };
    } catch { /* not up yet */ }
    await sleep(500);
  }
  await stop();
  throw new Error(`wrangler dev did not start:\n${log}`);
}
