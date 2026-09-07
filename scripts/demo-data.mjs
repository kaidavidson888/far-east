/**
 * Optional: three reader accounts with reviews, shelves and one live share link,
 * so the community surfaces have something in them.
 *
 *   npm run demo
 *
 * Local development only. It creates accounts with a known shared password and
 * needs the service-role key, which bypasses every access control in the project.
 */
import './load-env.mjs';
import { createClient } from '@supabase/supabase-js';
import postgres from 'postgres';
import { randomBytes } from 'node:crypto';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
// "secret key" is the current name; service_role is the legacy equivalent.
const serviceKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
const dbUrl = process.env.DATABASE_URL;

if (!url || !serviceKey || !dbUrl) {
  console.error(
    'Needs NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY and DATABASE_URL.\n' +
    'See .env.example. Do not run this against production.',
  );
  process.exit(1);
}

const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
const sql = postgres(dbUrl, { prepare: false, max: 4 });

const PASSWORD = 'farfareast';
const PEOPLE = [
  { email: 'mei@example.com', name: 'Mei Tan' },
  { email: 'arto@example.com', name: 'Arto Lehto' },
  { email: 'ren@example.com', name: 'Ren Kobayashi' },
];

const REVIEWS = [
  ['mei@example.com', 'chunghwa-hard-pack', 9, 'Still the one everything else is measured against',
    'Smoked these for years and the consistency is the thing. Four packs from two different cities and I could not tell them apart. The sweetness is real but it never turns into candy.'],
  ['mei@example.com', 'yuxi-soft', 8, 'The apricot note is not marketing',
    'It genuinely smells like stone fruit when you open the pack. Soft pack is a nuisance in a bag though — I have crushed two.'],
  ['mei@example.com', 'furongwang-blue', 7, 'Dry where Chunghwa is sweet', ''],
  ['arto@example.com', 'gitanes-brunes', 10, 'Nothing else tastes like this any more',
    'Every year there are fewer places selling dark tobacco and every year I stockpile a little harder. Yes it is harsh. That is the whole point of it.'],
  ['arto@example.com', 'lucky-strike-original-red', 8, 'The unfiltered Lucky is underrated',
    'Toasted Virginia with no filter in the way. Burns straight every time, which unfiltered cigarettes often do not.'],
  ['arto@example.com', 'silk-cut-purple', 3, 'Tastes like the paper',
    'By the last third there is nothing there but the wrapper. I do not understand who this is for.'],
  ['ren@example.com', 'mevius-original', 9, 'The build quality is the review',
    'Twenty years of these and I have had maybe three bad sticks. Nothing else comes close on consistency.'],
  ['ren@example.com', 'seven-stars', 8, 'When Mevius is too polite', ''],
  ['ren@example.com', 'peace-deluxe', 7, 'A museum piece you can still buy',
    'The tin alone is worth it. The cigarette is enormous and I can manage one a week, not more.'],
  ['ren@example.com', 'this-plus-1mg', 4, 'Warm air', 'You end up smoking three to feel anything. That cannot be the intent.'],
];

const SHELVES = {
  'mei@example.com': [['chunghwa-hard-pack', 'The benchmark. Everything else gets compared to this.'], ['yuxi-soft', 'For when the Chunghwa is too sweet.'], ['furongwang-blue', '']],
  'arto@example.com': [['gitanes-brunes', 'Stockpiling while it still exists.'], ['lucky-strike-original-red', ''], ['gudang-garam-international', 'Once a month, outdoors, with coffee.']],
  'ren@example.com': [['mevius-original', 'The control sample.'], ['seven-stars', ''], ['davidoff-classic', 'The European equivalent of the Mevius idea.']],
};

const ids = new Map();

try {
  const [{ n }] = await sql`SELECT COUNT(*)::int AS n FROM cigarettes`;
  if (n === 0) {
    console.error('The catalogue is empty. Run `npm run seed` first.');
    process.exit(1);
  }

  for (const p of PEOPLE) {
    const existing = await sql`SELECT id FROM auth.users WHERE email = ${p.email}`;
    if (existing.length) {
      ids.set(p.email, existing[0].id);
      continue;
    }
    const { data, error } = await admin.auth.admin.createUser({
      email: p.email,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { display_name: p.name },
    });
    if (error) throw error;
    ids.set(p.email, data.user.id);
  }

  for (const [email, slug, rating, title, body] of REVIEWS) {
    await sql`
      INSERT INTO reviews (user_id, cigarette_id, rating, title, body)
      SELECT ${ids.get(email)}, c.id, ${rating}, ${title}, ${body}
      FROM cigarettes c WHERE c.slug = ${slug}
      ON CONFLICT (user_id, cigarette_id) DO UPDATE SET
        rating = EXCLUDED.rating, title = EXCLUDED.title, body = EXCLUDED.body
    `;
  }

  for (const [email, entries] of Object.entries(SHELVES)) {
    for (const [slug, note] of entries) {
      await sql`
        INSERT INTO favorites (user_id, cigarette_id, note)
        SELECT ${ids.get(email)}, c.id, ${note}
        FROM cigarettes c WHERE c.slug = ${slug}
        ON CONFLICT (user_id, cigarette_id) DO UPDATE SET note = EXCLUDED.note
      `;
    }
  }

  // One live snapshot link, so the shared view has something to show.
  const mei = ids.get('mei@example.com');
  const live = await sql`SELECT token FROM shares WHERE user_id = ${mei} AND revoked_at IS NULL`;
  let token = live[0]?.token;
  if (!token) {
    token = randomBytes(12).toString('base64url');
    await sql.begin(async (tx) => {
      const [s] = await tx`INSERT INTO shares (token, user_id) VALUES (${token}, ${mei}) RETURNING id`;
      await tx`
        INSERT INTO share_items (share_id, cigarette_id, note, rating, review_title, position)
        SELECT ${s.id}, f.cigarette_id, f.note, r.rating, COALESCE(r.title, ''),
               ROW_NUMBER() OVER (ORDER BY f.created_at DESC)
        FROM favorites f
        LEFT JOIN reviews r ON r.user_id = f.user_id AND r.cigarette_id = f.cigarette_id
        WHERE f.user_id = ${mei}
      `;
    });
  }

  console.log('Demo data ready. Sign in with any of:');
  for (const p of PEOPLE) console.log(`  ${p.email} / ${PASSWORD}`);
  console.log(`\nShared shelf: /list/${token}`);
} finally {
  await sql.end();
}
