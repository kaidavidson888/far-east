/**
 * Works out why a database password is being rejected, by trying the connection
 * several different ways with one entry of the password.
 *
 *   npm run diagnose-db
 *
 * The password is hidden as you type and never printed, logged, or saved unless
 * a connection actually succeeds.
 */
import './load-env.mjs';
import postgres from 'postgres';
import { readFileSync, writeFileSync, copyFileSync, existsSync } from 'node:fs';
import readline from 'node:readline';
import { parseConnection } from './lib/parse-connection.mjs';

if (!process.stdin.isTTY) {
  console.error('Needs a real terminal so the password can be hidden. Run: npm run diagnose-db');
  process.exit(1);
}

const FILE = '.env.local';
const line = readFileSync(FILE, 'utf8').split('\n').find((l) => l.startsWith('DATABASE_URL='));
const conn = parseConnection(line?.slice('DATABASE_URL='.length) ?? '');
if (!conn.ok) { console.error(`Could not parse DATABASE_URL in ${FILE}.`); process.exit(1); }

const [host, port = '6543'] = conn.hostPort.split(':');

console.log(`
Project ref : ${conn.ref}
Pooler user : ${conn.user}
Host        : ${host}:${port}

Check that project ref matches the project whose password you just reset —
resetting it on the wrong project is the most common cause of this.
`);

const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
let muted = false;
rl._writeToOutput = function (s) { if (!muted || s.includes('Password')) rl.output.write(s); };
const password = await new Promise((res) => {
  muted = true;
  rl.question('Password: ', (a) => { rl.output.write('\n'); muted = false; rl.close(); res(a); });
});

// Describe the password without revealing it — invisible characters are a
// frequent cause and are impossible to spot by eye.
const trimmed = password.trim();
const classes = [];
if (/[a-z]/.test(trimmed)) classes.push('lowercase');
if (/[A-Z]/.test(trimmed)) classes.push('uppercase');
if (/[0-9]/.test(trimmed)) classes.push('digits');
const specials = [...new Set(trimmed.split('').filter((c) => !/[A-Za-z0-9]/.test(c)))];

console.log(`
Read ${password.length} characters${password.length !== trimmed.length
  ? ` — WARNING: ${password.length - trimmed.length} are leading/trailing whitespace, likely from the paste`
  : ''}
  contains        : ${classes.join(', ') || 'nothing recognised'}${specials.length ? `, specials ${specials.map((c) => JSON.stringify(c)).join(' ')}` : ', no special characters'}
  non-ASCII       : ${/[^\x20-\x7e]/.test(trimmed) ? 'YES — this will not survive a connection string' : 'no'}
`);

const base = { database: conn.dbName, connect_timeout: 12, max: 1, idle_timeout: 1, prepare: false };

const attempts = [
  {
    name: 'Transaction pooler, password in the URI (what the app uses)',
    make: () => postgres(`${conn.scheme}${conn.user}:${encodeURIComponent(trimmed)}@${host}:${port}/${conn.dbName}`, { prepare: false, connect_timeout: 12, max: 1, idle_timeout: 1 }),
    url: (p) => `${conn.scheme}${conn.user}:${encodeURIComponent(p)}@${host}:${port}/${conn.dbName}`,
  },
  {
    name: 'Transaction pooler, password passed separately (bypasses URI encoding)',
    make: () => postgres({ ...base, host, port: Number(port), username: conn.user, password: trimmed }),
    url: (p) => `${conn.scheme}${conn.user}:${encodeURIComponent(p)}@${host}:${port}/${conn.dbName}`,
  },
  {
    name: 'Session pooler on port 5432',
    make: () => postgres({ ...base, host, port: 5432, username: conn.user, password: trimmed }),
    url: (p) => `${conn.scheme}${conn.user}:${encodeURIComponent(p)}@${host}:5432/${conn.dbName}`,
  },
  {
    name: 'Untrimmed password (in case the spaces are real)',
    make: () => postgres({ ...base, host, port: Number(port), username: conn.user, password }),
    url: (p) => `${conn.scheme}${conn.user}:${encodeURIComponent(password)}@${host}:${port}/${conn.dbName}`,
  },
];

let winner = null;
for (const a of attempts) {
  const sql = a.make();
  try {
    await sql`select 1`;
    console.log(`  ✓ ${a.name}`);
    winner ??= a;
  } catch (e) {
    console.log(`  ✗ ${a.name}\n      ${String(e.message).slice(0, 110)}`);
  } finally {
    await sql.end({ timeout: 2 });
  }
}

if (winner) {
  const text = readFileSync(FILE, 'utf8');
  copyFileSync(FILE, `${FILE}.bak`);
  writeFileSync(FILE, text.replace(/^DATABASE_URL=.*$/m, `DATABASE_URL=${winner.url(trimmed)}`));
  console.log(`\n✓ Saved the working connection to ${FILE} (previous kept as ${FILE}.bak).`);
  console.log('  Next: npm run seed');
} else {
  console.log(`
None worked, and nothing was saved.

That points at the password itself rather than the connection. Two things to check:
  1. The project ref above (${conn.ref}) — is that the project you reset the password on?
     The dashboard shows it in Project Settings → General → Project ID.
  2. Reset it again and use the dashboard's copy button rather than retyping or
     re-reading it. Then run this again.
`);
  process.exitCode = 1;
}
