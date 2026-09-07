// Read-only diagnostic. Prints counts and structure, never values from .env.
import '../scripts/load-env.mjs';
import postgres from 'postgres';
const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 2, connect_timeout: 15 });
try {
  const [u] = await sql`SELECT COUNT(*)::int AS n FROM auth.users`;
  const [p] = await sql`SELECT COUNT(*)::int AS n FROM profiles`;
  const [f] = await sql`SELECT COUNT(*)::int AS n FROM favorites`;
  const [r] = await sql`SELECT COUNT(*)::int AS n FROM reviews`;
  const [c] = await sql`SELECT COUNT(*)::int AS n FROM cigarettes`;
  console.log(`auth.users : ${u.n}`);
  console.log(`profiles   : ${p.n}`);
  console.log(`favorites  : ${f.n}`);
  console.log(`reviews    : ${r.n}`);
  console.log(`cigarettes : ${c.n}`);

  const trig = await sql`
    SELECT tgname FROM pg_trigger
    WHERE tgrelid = 'auth.users'::regclass AND NOT tgisinternal
  `;
  console.log(`\nsignup trigger present: ${trig.length ? trig.map(t => t.tgname).join(', ') : 'NO — this is the problem'}`);

  if (u.n > 0 && p.n === 0) {
    console.log('\n>>> Users exist but have no profile row. Every favorite/review insert');
    console.log('    will fail its foreign key, because they reference profiles(id).');
  }
} catch (e) {
  console.error('FAILED:', e.message);
} finally {
  await sql.end({ timeout: 2 });
}
