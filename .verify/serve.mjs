/** Boots a throwaway Postgres, applies the schema, seeds it, and stays alive. */
import { boot } from './pg.mjs';
import postgres from 'postgres';
import { readFileSync } from 'node:fs';
import { randomUUID, randomBytes } from 'node:crypto';

const URL_ = 'postgres://postgres:postgres@127.0.0.1:54329/fareast';
const pg = await boot();
const sql = postgres(URL_, { prepare: false, max: 4 });

await sql.unsafe(`
  create schema if not exists auth;
  create table if not exists auth.users (
    id uuid primary key default gen_random_uuid(),
    email text not null,
    raw_user_meta_data jsonb not null default '{}'::jsonb
  );
`);
await sql.unsafe(readFileSync('supabase/migrations/0001_schema.sql', 'utf8'));

process.env.DATABASE_URL = URL_;
await import('../scripts/seed-catalog.mjs');

const uid = randomUUID();
await sql`INSERT INTO auth.users (id, email, raw_user_meta_data)
          VALUES (${uid}, 'mei@example.com', ${sql.json({ display_name: 'Mei Tan' })})`;

const rows = [
  ['chunghwa-hard-pack', 9, 'Still the reference point', 'Four packs, two cities, indistinguishable.'],
  ['mevius-original', 10, 'The build quality is the review', 'Twenty years, maybe three bad sticks.'],
  ['gitanes-brunes', 8, 'Nothing else tastes like this', ''],
];
for (const [slug, rating, title, body] of rows) {
  await sql`INSERT INTO reviews (user_id, cigarette_id, rating, title, body)
            SELECT ${uid}, id, ${rating}, ${title}, ${body} FROM cigarettes WHERE slug = ${slug}`;
  await sql`INSERT INTO favorites (user_id, cigarette_id, note)
            SELECT ${uid}, id, ${'On the shelf since March.'} FROM cigarettes WHERE slug = ${slug}`;
}

const token = randomBytes(12).toString('base64url');
await sql.begin(async (tx) => {
  const [s] = await tx`INSERT INTO shares (token, user_id) VALUES (${token}, ${uid}) RETURNING id`;
  await tx`
    INSERT INTO share_items (share_id, cigarette_id, note, rating, review_title, position)
    SELECT ${s.id}, f.cigarette_id, f.note, r.rating, COALESCE(r.title, ''),
           ROW_NUMBER() OVER (ORDER BY f.created_at DESC)
    FROM favorites f
    LEFT JOIN reviews r ON r.user_id = f.user_id AND r.cigarette_id = f.cigarette_id
    WHERE f.user_id = ${uid}`;
});

console.log(`READY token=${token}`);
await sql.end();
process.on('SIGTERM', async () => { await pg.stop(); process.exit(0); });
await new Promise(() => {});
