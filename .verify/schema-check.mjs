import '../scripts/load-env.mjs';
import postgres from 'postgres';
const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 2 });
try {
  const t = await sql`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema='public' ORDER BY table_name`;
  console.log(`tables (${t.length}):`, t.map(r=>r.table_name).join(', '));

  const old = await sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_name='cigarettes' AND column_name IN ('score','criteria','tested','award')`;
  console.log('0002 applied (editorial columns gone):', old.length === 0 ? 'yes' : `NO — ${old.map(c=>c.column_name)}`);

  const rls = await sql`
    SELECT relname FROM pg_class
    WHERE relnamespace='public'::regnamespace AND relkind='r' AND NOT relrowsecurity`;
  console.log('RLS on every table:', rls.length === 0 ? 'yes' : `NO — ${rls.map(r=>r.relname)}`);
} finally { await sql.end({ timeout: 2 }); }
