/**
 * Sets the database password in .env.local without it ever appearing on screen,
 * in shell history, or in a file you have to hand-edit — then immediately tests
 * the connection so you know straight away whether it worked.
 *
 *   npm run set-db-password
 */
import './load-env.mjs';
import postgres from 'postgres';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import readline from 'node:readline';

const FILE = '.env.local';
if (!existsSync(FILE)) {
  console.error(`No ${FILE}. Copy .env.example to ${FILE} first.`);
  process.exit(1);
}

if (!process.stdin.isTTY) {
  console.error(
    'This hides the password as you type, which needs a real terminal.\n' +
    'Run it directly: npm run set-db-password',
  );
  process.exit(1);
}

const text = readFileSync(FILE, 'utf8');
const line = text.split('\n').find((l) => l.startsWith('DATABASE_URL='));
if (!line) {
  console.error(`No DATABASE_URL line in ${FILE}.`);
  process.exit(1);
}

const parts = line.slice('DATABASE_URL='.length).trim()
  .match(/^(postgres(?:ql)?:\/\/)([^:]+):([^@]*)@(.+)$/);
if (!parts) {
  console.error('DATABASE_URL does not look like a connection URI.');
  process.exit(1);
}
const [, scheme, user, , tail] = parts;

const targetRef = user.includes('.') ? user.split('.').slice(1).join('.') : user;
console.log(`\n  PROJECT: ${targetRef}`);
console.log(`  Host   : ${tail.split('/')[0]}`);
console.log('\n  ^ check that project ref matches the one you reset the password on.');
console.log('\nSupabase → Project Settings → Database → Reset database password.');
console.log('Copy the new password, then paste it below. Input stays hidden.\n');

const password = await new Promise((resolve) => {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  // Suppress echo so the password never reaches the screen or scrollback.
  rl._writeToOutput = function (s) {
    if (s.includes('Password')) rl.output.write(s);
  };
  rl.question('Password: ', (answer) => { rl.output.write('\n'); rl.close(); resolve(answer); });
});

const clean = password.trim();
if (!clean) {
  console.error('Nothing entered — no changes made.');
  process.exit(1);
}

// Percent-encode so characters like @ : / ? # % cannot break the URI.
const encoded = encodeURIComponent(clean);
const url = `${scheme}${user}:${encoded}@${tail}`;

console.log(`\nRead ${clean.length} characters. Testing the connection…`);

const sql = postgres(url, { prepare: false, connect_timeout: 15, max: 1, idle_timeout: 1 });
try {
  const [row] = await sql`SELECT current_database() AS db, current_user AS who`;
  const tables = await sql`
    SELECT COUNT(*)::int AS n FROM information_schema.tables WHERE table_schema = 'public'
  `;
  writeFileSync(FILE, text.replace(/^DATABASE_URL=.*$/m, `DATABASE_URL=${url}`));
  console.log(`\n✓ Connected to "${row.db}" as "${row.who}".`);
  console.log(`✓ Saved to ${FILE}.`);
  console.log(`\nPublic tables found: ${tables[0].n}`);
  console.log(tables[0].n === 0
    ? '→ The schema has not been created yet. Run supabase/migrations/0001_schema.sql in the SQL Editor, then `npm run seed`.'
    : '→ Next: npm run seed');
} catch (e) {
  const msg = String(e.message);
  console.error(`\n✗ Connection failed: ${msg}`);
  console.error('\nNothing was saved.');
  if (/password authentication/i.test(msg)) {
    console.error('The password was rejected. Reset it again in Supabase and copy it with the');
    console.error('copy button rather than retyping it — a trailing space or a missed character');
    console.error('is the usual cause.');
  } else if (/tenant|not found/i.test(msg)) {
    console.error('The host or project ref is wrong for this project.');
  }
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 2 });
}
