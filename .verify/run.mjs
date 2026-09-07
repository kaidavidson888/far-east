/**
 * Runs the real schema and every query in lib/db.ts against a throwaway
 * Postgres, so the migration is not delivered untested.
 */
import { boot } from './pg.mjs';
import postgres from 'postgres';
import { readFileSync } from 'node:fs';
import { randomUUID, randomBytes } from 'node:crypto';

const URL_ = 'postgres://postgres:postgres@127.0.0.1:54329/fareast';
let pg, sql, failures = 0, checks = 0;

function check(label, condition, detail = '') {
  checks++;
  if (condition) console.log(`  ✓ ${label}`);
  else { failures++; console.log(`  ✗ ${label} ${detail}`); }
}

try {
  pg = await boot();
  sql = postgres(URL_, { prepare: false, max: 4 });

  console.log('\n— schema —');
  // Supabase provides auth.users; stand in a minimal equivalent so the
  // migration's foreign key and trigger can be exercised.
  await sql.unsafe(`
    create schema if not exists auth;
    create table if not exists auth.users (
      id uuid primary key default gen_random_uuid(),
      email text not null,
      raw_user_meta_data jsonb not null default '{}'::jsonb
    );
  `);
  const { readdirSync } = await import('node:fs');
  const migrations = readdirSync('supabase/migrations').filter((f) => f.endsWith('.sql')).sort();
  for (const m of migrations) {
    await sql.unsafe(readFileSync(`supabase/migrations/${m}`, 'utf8'));
  }
  check(`all ${migrations.length} migrations apply cleanly`, true, migrations.join(', '));

  const gone = await sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'cigarettes' AND column_name IN ('score','criteria','tested','award')
  `;
  check('editorial scoring columns are gone', gone.length === 0,
    JSON.stringify(gone.map((g) => g.column_name)));

  const tables = await sql`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' ORDER BY table_name
  `;
  check('all 7 tables created', tables.length === 7, JSON.stringify(tables.map((t) => t.table_name)));

  const rls = await sql`
    SELECT relname, relrowsecurity FROM pg_class
    WHERE relnamespace = 'public'::regnamespace AND relkind = 'r'
  `;
  check('RLS enabled on every table', rls.every((r) => r.relrowsecurity),
    JSON.stringify(rls.filter((r) => !r.relrowsecurity).map((r) => r.relname)));

  console.log('\n— signup trigger —');
  const uid = randomUUID();
  await sql`
    INSERT INTO auth.users (id, email, raw_user_meta_data)
    VALUES (${uid}, 'mei@example.com', ${sql.json({ display_name: 'Mei Tan' })})
  `;
  const [profile] = await sql`SELECT * FROM profiles WHERE id = ${uid}`;
  check('profile auto-created with display_name', profile?.display_name === 'Mei Tan',
    JSON.stringify(profile));

  const uid2 = randomUUID();
  await sql`INSERT INTO auth.users (id, email) VALUES (${uid2}, 'noname@example.com')`;
  const [p2] = await sql`SELECT * FROM profiles WHERE id = ${uid2}`;
  check('falls back to email local part', p2?.display_name === 'noname', JSON.stringify(p2));

  console.log('\n— catalogue seed —');
  process.env.DATABASE_URL = URL_;
  await import('../scripts/seed-catalog.mjs');
  const [{ n }] = await sql`SELECT COUNT(*)::int AS n FROM cigarettes`;
  check('32 cigarettes seeded', n === 32, `got ${n}`);
  const [cjk] = await sql`SELECT cjk FROM cigarettes WHERE slug = 'chunghwa-hard-pack'`;
  check('CJK survives the round trip', cjk.cjk === '中华', JSON.stringify(cjk));
  const [j] = await sql`SELECT pros, cons FROM cigarettes WHERE slug = 'mevius-original'`;
  check('jsonb returns parsed arrays',
    Array.isArray(j.pros) && Array.isArray(j.cons) && j.pros.length > 0,
    JSON.stringify({ pros: j.pros?.length, cons: j.cons?.length }));

  console.log('\n— lib/db.ts queries —');
  process.env.DATABASE_URL = URL_;
  // Exercise the SQL directly, mirroring lib/db.ts.
  const [mevius] = await sql`SELECT id FROM cigarettes WHERE slug = 'mevius-original'`;
  const [gitanes] = await sql`SELECT id FROM cigarettes WHERE slug = 'gitanes-brunes'`;

  await sql`INSERT INTO reviews (user_id, cigarette_id, rating, title, body)
            VALUES (${uid}, ${mevius.id}, 9, 'Reference grade', 'Consistent.')`;
  await sql`INSERT INTO reviews (user_id, cigarette_id, rating, title, body)
            VALUES (${uid2}, ${mevius.id}, 8, 'Solid', '')`;
  await sql`INSERT INTO reviews (user_id, cigarette_id, rating, title, body)
            VALUES (${uid}, ${mevius.id}, 10, 'Updated', 'Changed my mind')
            ON CONFLICT (user_id, cigarette_id) DO UPDATE
            SET rating = EXCLUDED.rating, title = EXCLUDED.title,
                body = EXCLUDED.body, updated_at = NOW()`;
  const [{ c: rc }] = await sql`SELECT COUNT(*)::int AS c FROM reviews WHERE cigarette_id = ${mevius.id}`;
  check('review upsert updates rather than duplicates', rc === 2, `got ${rc}`);

  const agg = await sql`
    SELECT c.*, ROUND(AVG(r.rating), 1)::float8 AS user_avg, COUNT(r.id)::int AS user_count
    FROM cigarettes c LEFT JOIN reviews r ON r.cigarette_id = c.id
    WHERE c.slug = 'mevius-original' GROUP BY c.id
  `;
  check('aggregates are numbers, not strings',
    agg[0].user_avg === 9 && agg[0].user_count === 2,
    `avg=${agg[0].user_avg} (${typeof agg[0].user_avg}) count=${agg[0].user_count} (${typeof agg[0].user_count})`);
  check('tar_mg is a number', typeof agg[0].tar_mg === 'number', typeof agg[0].tar_mg);

  const unrated = await sql`
    SELECT ROUND(AVG(r.rating), 1)::float8 AS user_avg, COUNT(r.id)::int AS user_count
    FROM cigarettes c LEFT JOIN reviews r ON r.cigarette_id = c.id
    WHERE c.slug = 'hope-regular' GROUP BY c.id
  `;
  check('unrated products give null avg / 0 count',
    unrated[0].user_avg === null && unrated[0].user_count === 0, JSON.stringify(unrated[0]));

  console.log('\n— filters —');
  const like = '%中华%';
  const cjkSearch = await sql`
    SELECT c.slug FROM cigarettes c
    WHERE (c.name ILIKE ${like} OR c.brand ILIKE ${like} OR c.country ILIKE ${like}
           OR c.summary ILIKE ${like} OR COALESCE(c.cjk, '') ILIKE ${like})
  `;
  check('CJK search matches', cjkSearch.length === 1 && cjkSearch[0].slug === 'chunghwa-hard-pack',
    JSON.stringify(cjkSearch.map((r) => r.slug)));

  const japan = await sql`SELECT slug FROM cigarettes WHERE country = ANY(${['Japan']})`;
  check('ANY() facet filter works', japan.length === 5, `got ${japan.length}`);

  const combo = await sql`
    SELECT slug FROM cigarettes
    WHERE country = ANY(${['Japan', 'China']}) AND strength = ANY(${['Full']}) AND tar_mg <= ${14}
  `;
  check('multi-facet + maxTar composes', combo.length >= 1, `got ${combo.length}`);

  const facets = await sql`
    SELECT 'country' AS facet, country AS value, COUNT(*)::int AS n FROM cigarettes GROUP BY country
    UNION ALL SELECT 'strength', strength, COUNT(*)::int FROM cigarettes GROUP BY strength
  `;
  const countries = facets.filter((f) => f.facet === 'country');
  check('facet counts return ints', countries.length === 10 && typeof countries[0].n === 'number',
    `${countries.length} countries, n is ${typeof countries[0]?.n}`);

  console.log('\n— favourites —');
  await sql`INSERT INTO favorites (user_id, cigarette_id, note) VALUES (${uid}, ${mevius.id}, 'The control sample.')`;
  await sql`INSERT INTO favorites (user_id, cigarette_id, note) VALUES (${uid}, ${gitanes.id}, '')`;
  const removed = await sql`DELETE FROM favorites WHERE user_id = ${uid} AND cigarette_id = ${gitanes.id} RETURNING id`;
  check('toggle off returns the deleted row', removed.length === 1);
  const removedAgain = await sql`DELETE FROM favorites WHERE user_id = ${uid} AND cigarette_id = ${gitanes.id} RETURNING id`;
  check('toggle on when absent returns nothing', removedAgain.length === 0);

  console.log('\n— share snapshots —');
  const token = randomBytes(12).toString('base64url');
  const share = await sql.begin(async (tx) => {
    await tx`UPDATE shares SET revoked_at = NOW() WHERE user_id = ${uid} AND revoked_at IS NULL`;
    const [s] = await tx`INSERT INTO shares (token, user_id) VALUES (${token}, ${uid}) RETURNING *`;
    await tx`
      INSERT INTO share_items (share_id, cigarette_id, note, rating, review_title, position)
      SELECT ${s.id}, f.cigarette_id, f.note, r.rating, COALESCE(r.title, ''),
             ROW_NUMBER() OVER (ORDER BY f.created_at DESC)
      FROM favorites f
      LEFT JOIN reviews r ON r.user_id = f.user_id AND r.cigarette_id = f.cigarette_id
      WHERE f.user_id = ${uid}
    `;
    return s;
  });
  const items = await sql`SELECT * FROM share_items WHERE share_id = ${share.id} ORDER BY position`;
  check('snapshot captured the shelf with rating + note',
    items.length === 1 && items[0].rating === 10 && items[0].note === 'The control sample.',
    JSON.stringify(items));

  // The snapshot must not follow later shelf changes.
  await sql`DELETE FROM favorites WHERE user_id = ${uid}`;
  const after = await sql`SELECT COUNT(*)::int AS n FROM share_items WHERE share_id = ${share.id}`;
  check('snapshot is frozen after the shelf changes', after[0].n === 1, JSON.stringify(after[0]));

  const token2 = randomBytes(12).toString('base64url');
  await sql.begin(async (tx) => {
    await tx`UPDATE shares SET revoked_at = NOW() WHERE user_id = ${uid} AND revoked_at IS NULL`;
    await tx`INSERT INTO shares (token, user_id) VALUES (${token2}, ${uid})`;
  });
  const active = await sql`SELECT COUNT(*)::int AS n FROM shares WHERE user_id = ${uid} AND revoked_at IS NULL`;
  check('only one live link per person', active[0].n === 1, JSON.stringify(active[0]));

  let violated = false;
  try {
    await sql`INSERT INTO shares (token, user_id) VALUES (${randomBytes(9).toString('base64url')}, ${uid})`;
  } catch { violated = true; }
  check('partial unique index rejects a second live link', violated);

  console.log('\n— cascade —');
  await sql`DELETE FROM auth.users WHERE id = ${uid}`;
  const orphans = await sql`
    SELECT (SELECT COUNT(*)::int FROM profiles WHERE id = ${uid}) AS p,
           (SELECT COUNT(*)::int FROM reviews WHERE user_id = ${uid}) AS r,
           (SELECT COUNT(*)::int FROM shares WHERE user_id = ${uid}) AS s
  `;
  check('deleting an auth user cascades everywhere',
    orphans[0].p === 0 && orphans[0].r === 0 && orphans[0].s === 0, JSON.stringify(orphans[0]));

  // ---- the real lib/db.ts, not a copy of its SQL ----
  // The raw-SQL checks above cannot catch driver type coercion: Postgres returns
  // int8 as a string, and ids are used as Map keys, so a mismatch silently
  // returns empty lists. Exercise the compiled module itself.
  console.log('\n— lib/db.ts (compiled) —');
  const { execFileSync } = await import('node:child_process');
  const { rmSync, writeFileSync, mkdirSync } = await import('node:fs');
  rmSync('.verify/build', { recursive: true, force: true });
  mkdirSync('.verify/build', { recursive: true });
  // Invoke the local tsc through the running node binary so this works the same
  // on Windows (where `npx` is a .cmd and execFileSync cannot spawn it directly).
  execFileSync(process.execPath, ['node_modules/typescript/bin/tsc',
    'lib/db.ts', '--outDir', '.verify/build', '--module', 'es2022',
    '--target', 'es2022', '--moduleResolution', 'bundler', '--resolveJsonModule', '--skipLibCheck'],
    { stdio: 'pipe' });
  writeFileSync('.verify/build/package.json', '{"type":"module"}\n');
  writeFileSync('.verify/build/db.js',
    readFileSync('.verify/build/db.js', 'utf8').replace(/^import 'server-only';$/m, ''));

  process.env.DATABASE_URL = URL_;
  const lib = await import('../.verify/build/db.js?t=' + Date.now());

  const cigs = await lib.listCigarettes();
  check('listCigarettes returns numeric ids', cigs.length === 32 && typeof cigs[0].id === 'number',
    `${cigs.length} rows, id is ${typeof cigs[0]?.id}`);

  // Reader ratings are the only score, so rated products must lead and
  // unrated ones must not float to the top on a plain DESC.
  const rated = cigs.filter((c) => c.userCount > 0);
  const firstUnrated = cigs.findIndex((c) => c.userCount === 0);
  check('rated products sort above unrated ones',
    rated.length > 0 && firstUnrated >= rated.length,
    `${rated.length} rated, first unrated at index ${firstUnrated}`);

  const owner = (await sql`SELECT id FROM profiles LIMIT 1`)[0].id;
  await sql`INSERT INTO favorites (user_id, cigarette_id, note)
            SELECT ${owner}, id, 'note' FROM cigarettes WHERE slug = 'camel-filters'
            ON CONFLICT DO NOTHING`;

  const favIds = await lib.favoriteIds(owner);
  check('favoriteIds returns numbers', favIds.length > 0 && favIds.every((i) => typeof i === 'number'),
    JSON.stringify(favIds));

  const shelf = await lib.favoritesWithNotes(owner);
  check('favoritesWithNotes resolves every favourite', shelf.length === favIds.length,
    `${shelf.length} resolved of ${favIds.length} saved`);

  const marked = cigs.filter((c) => new Set(favIds).has(c.id));
  check('catalogue marks saved items as on the shelf', marked.length === favIds.length,
    `${marked.length} of ${favIds.length}`);

  console.log(`\n${checks - failures}/${checks} checks passed`);
} catch (e) {
  failures++;
  console.error('\nHARNESS ERROR:', e?.message ?? e);
  if (e?.query) console.error('query:', e.query);
} finally {
  if (sql) await sql.end();
  if (pg) await pg.stop();
  process.exit(failures ? 1 : 0);
}
