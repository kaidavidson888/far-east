/**
 * Points the app at a Supabase project and verifies it before saving.
 *
 *   npm run link-supabase
 *
 * Asks for the two things you can copy straight from the dashboard, derives
 * everything else, tests the connection, and only then writes .env.local.
 * Nothing is echoed to the screen or shell history.
 */
import './load-env.mjs';
import postgres from 'postgres';
import { readFileSync, writeFileSync, existsSync, copyFileSync } from 'node:fs';
import readline from 'node:readline';
import { parseConnection } from './lib/parse-connection.mjs';

const FILE = '.env.local';

// One interface for every prompt: separate ones would each buffer stdin and
// eat the following answer.
if (!process.stdin.isTTY) {
  console.error(
    'This asks for a password and hides it as you type, which needs a real terminal.\n' +
    'Run it directly: npm run link-supabase',
  );
  process.exit(1);
}

const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
let muted = false;
rl._writeToOutput = function (s) {
  if (!muted || s.includes('password')) rl.output.write(s);
};

function ask(question, { hidden = false } = {}) {
  return new Promise((resolve) => {
    muted = hidden;
    rl.question(question, (a) => {
      if (hidden) rl.output.write('\n');
      muted = false;
      resolve(a.trim());
    });
  });
}

console.log(`
Supabase → Connect (top of the dashboard) → Transaction pooler → copy the URI.
It looks like:
  postgresql://postgres.abcdefgh:[YOUR-PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres
`);

const conn = parseConnection(await ask('Connection string: '));
if (!conn.ok && conn.error === 'not-a-uri') {
  console.error('\nThat does not look like a connection URI. Copy the whole line, including postgresql://');
  rl.close(); process.exit(1);
}
if (!conn.ok) {
  console.error(`\nExpected a pooler user like "postgres.<project-ref>", got "${conn.user}".`);
  console.error('Make sure you copied the Transaction pooler tab, not Direct connection.');
  rl.close(); process.exit(1);
}
const { scheme, user, hostPort, dbName, ref, projectUrl } = conn;
if (ref === 'abcdefgh') {
  console.error('\nThat is the example from the prompt above, not your connection string.');
  console.error('Copy it from the dashboard: Connect → Transaction pooler.');
  rl.close(); process.exit(1);
}
if (!conn.isTransactionPooler) {
  console.warn('\n! Port is not 6543. Serverless needs the transaction pooler; continuing anyway.');
}

const password = await ask('Database password (hidden): ', { hidden: true });
if (!password) { console.error('Nothing entered.'); rl.close(); process.exit(1); }

const key = await ask('Publishable key (sb_publishable_...): ');
rl.close();
if (!key) { console.error('Nothing entered.'); process.exit(1); }

const dbUrl = `${scheme}${user}:${encodeURIComponent(password)}@${hostPort}/${dbName}`;

console.log(`\nProject : ${projectUrl}`);
console.log(`Host    : ${hostPort}`);
console.log('\nTesting the connection…');

const sql = postgres(dbUrl, { prepare: false, connect_timeout: 15, max: 1, idle_timeout: 1 });
try {
  const [who] = await sql`SELECT current_database() AS db`;
  const [t] = await sql`
    SELECT COUNT(*)::int AS n FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name IN
      ('profiles','cigarettes','reviews','favorites','shares','share_items','subscribers')
  `;
  const [c] = t.n > 0
    ? await sql`SELECT COUNT(*)::int AS n FROM cigarettes`
    : [{ n: 0 }];

  if (existsSync(FILE)) copyFileSync(FILE, `${FILE}.bak`);
  writeFileSync(FILE, [
    '# Written by `npm run link-supabase`.',
    `NEXT_PUBLIC_SUPABASE_URL=${projectUrl}`,
    `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${key}`,
    `DATABASE_URL=${dbUrl}`,
    '',
    '# Only needed for `npm run demo`. Never deploy this.',
    '# SUPABASE_SECRET_KEY=sb_secret_...',
    '',
  ].join('\n'));

  console.log(`\n✓ Connected to "${who.db}".`);
  console.log(`✓ Saved to ${FILE}${existsSync(`${FILE}.bak`) ? ` (previous version kept as ${FILE}.bak)` : ''}.`);
  console.log(`\nSchema tables found: ${t.n} of 7`);
  console.log(`Catalogue rows     : ${c.n}`);
  console.log('\nNext:');
  if (t.n < 7) {
    console.log('  1. Run supabase/migrations/0001_schema.sql, then 0002_user_ratings.sql,');
    console.log('     in the SQL Editor of this project.');
    console.log('  2. npm run seed');
  } else if (c.n === 0) {
    console.log('  1. npm run seed');
  } else {
    console.log('  Everything is in place — npm run dev');
  }
} catch (e) {
  const msg = String(e.message);
  console.error(`\n✗ Connection failed: ${msg}`);
  console.error(`\nNothing was saved; ${FILE} is untouched.`);
  if (/password authentication/i.test(msg)) {
    console.error('The password was rejected. Reset it in Project Settings → Database and copy it.');
  } else if (/tenant|not found/i.test(msg)) {
    console.error('The host does not host this project — re-copy the Transaction pooler URI.');
  }
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 2 });
}
