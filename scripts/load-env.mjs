/**
 * Loads .env.local (then .env) into process.env.
 *
 * Next.js does this automatically, but the standalone scripts run under plain
 * `node`, which does not. Node's own --env-file flag needs 20.6+, and this has
 * to work on whatever version is in front of it, so it is done by hand.
 *
 * Existing environment variables always win, so CI and shell exports override
 * the file.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

for (const file of ['.env.local', '.env']) {
  const full = path.join(process.cwd(), file);
  if (!existsSync(full)) continue;

  for (const raw of readFileSync(full, 'utf8').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;

    const eq = line.indexOf('=');
    if (eq === -1) continue;

    const key = line.slice(0, eq).trim();
    if (!key || key in process.env) continue;

    let value = line.slice(eq + 1).trim();
    // Tolerate quoted values, which people add out of habit.
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}
