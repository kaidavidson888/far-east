import '../scripts/load-env.mjs';
import postgres from 'postgres';
import { readFileSync } from 'node:fs';
const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 2 });
try {
  await sql.unsafe(readFileSync('supabase/migrations/0002_user_ratings.sql', 'utf8'));
  const left = await sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'cigarettes' AND column_name IN ('score','criteria','tested','award')
  `;
  console.log('0002 applied · editorial columns remaining:', left.length ? left.map(c=>c.column_name) : 'none');
} finally { await sql.end({ timeout: 2 }); }
