import { parseConnection } from '../scripts/lib/parse-connection.mjs';
let fail = 0;
const t = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fail++;
  console.log(`  ${ok ? '✓' : '✗'} ${label}${ok ? '' : `\n      got ${JSON.stringify(got)}\n     want ${JSON.stringify(want)}`}`);
};

const pooler = parseConnection('postgresql://postgres.abcdefghijklmno:[YOUR-PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres');
t('transaction pooler → ref', pooler.ref, 'abcdefghijklmno');
t('transaction pooler → project url', pooler.projectUrl, 'https://abcdefghijklmno.supabase.co');
t('transaction pooler → recognised', pooler.isTransactionPooler, true);
t('transaction pooler → host kept', pooler.hostPort, 'aws-0-us-east-1.pooler.supabase.com:6543');

t('session pooler flagged as not-transaction',
  parseConnection('postgresql://postgres.abc:[PW]@aws-1-eu-west-2.pooler.supabase.com:5432/postgres').isTransactionPooler, false);

t('direct connection rejected',
  parseConnection('postgresql://postgres:[PW]@db.abc.supabase.co:5432/postgres').error, 'not-pooler-user');

t('postgres:// scheme accepted', parseConnection('postgres://postgres.xyz:[PW]@h.com:6543/postgres').ok, true);
t('query string tolerated', parseConnection('postgresql://postgres.xyz:[PW]@h.com:6543/postgres?sslmode=require').dbName, 'postgres');
t('surrounding quotes tolerated', parseConnection('"postgresql://postgres.xyz:[PW]@h.com:6543/postgres"').ref, 'xyz');
t('whitespace tolerated', parseConnection('  postgresql://postgres.xyz:[PW]@h.com:6543/postgres  ').ref, 'xyz');
t('garbage rejected', parseConnection('not-a-url').error, 'not-a-uri');
t('empty rejected', parseConnection('').error, 'not-a-uri');

console.log(fail ? `\n${fail} failed` : '\nall parse checks passed');
process.exit(fail ? 1 : 0);
