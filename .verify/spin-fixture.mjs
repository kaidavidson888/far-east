/**
 * Throwaway fixture for verifying the My Saved spin.
 *
 * Makes the temp user look like somebody who has finished signing up — an
 * email identity AND a google one, which is what `splashAuthAction` insists
 * on before it lets anyone through — and puts a handful of packs on their
 * shelf. Run `node .verify/temp-user.mjs delete` afterwards; that cascades.
 */
import '../scripts/load-env.mjs';
import postgres from 'postgres';
import { readFileSync } from 'node:fs';

const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 2 });
const EMAIL = 'fe-verify-temp@farfareast.dev';

const packs = JSON.parse(readFileSync(new URL('../lib/cigs.json', import.meta.url), 'utf8'));
const pages = JSON.parse(readFileSync(new URL('../lib/cigpages.json', import.meta.url), 'utf8'));
const pageIds = new Set(pages.pages.map((p) => p.id));
const list = (packs.packs ?? packs).filter((p) => pageIds.has(p.id));

// six, spread across the row so the swap is obvious rather than a coincidence
const PICK = [0, 40, 90, 140, 190, 230].map((i) => list[i % list.length].id);

const [u] = await sql`SELECT id FROM auth.users WHERE email = ${EMAIL}`;
if (!u) throw new Error('run .verify/temp-user.mjs first');

await sql`
  INSERT INTO auth.identities (provider, provider_id, user_id, identity_data, last_sign_in_at, created_at, updated_at)
  VALUES ('google', ${'g-' + u.id}, ${u.id},
          ${sql.json({ sub: 'g-' + u.id, email: EMAIL, email_verified: true })}, now(), now(), now())
  ON CONFLICT DO NOTHING`;

await sql`DELETE FROM pack_favorites WHERE user_id = ${u.id}`;
for (const id of PICK) {
  await sql`INSERT INTO pack_favorites (user_id, pack_id) VALUES (${u.id}, ${id})`;
}

const saved = await sql`SELECT pack_id FROM pack_favorites WHERE user_id = ${u.id} ORDER BY created_at DESC`;
console.log('google identity: yes');
console.log('shelf:', saved.map((r) => r.pack_id).join(', '));
console.log('packs on the row:', list.length, '-> shelf of', saved.length);
await sql.end();
