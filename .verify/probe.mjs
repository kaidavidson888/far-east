/**
 * Finds which Supabase pooler host serves a project, using a deliberately wrong
 * password. "Tenant or user not found" = wrong host; an auth complaint = right host.
 * No real credentials involved.
 *
 *   node .verify/probe.mjs <project-ref>
 */
import postgres from 'postgres';

const REF = process.argv[2];
if (!REF) { console.error('usage: node .verify/probe.mjs <project-ref>'); process.exit(1); }

const REGIONS = [
  'us-east-1', 'us-east-2', 'us-west-1', 'us-west-2', 'ca-central-1',
  'eu-west-1', 'eu-west-2', 'eu-west-3', 'eu-central-1', 'eu-north-1',
  'ap-south-1', 'ap-southeast-1', 'ap-southeast-2', 'ap-northeast-1',
  'ap-northeast-2', 'sa-east-1',
];
const hosts = REGIONS.flatMap((r) => [`aws-0-${r}.pooler.supabase.com`, `aws-1-${r}.pooler.supabase.com`]);

const results = await Promise.all(hosts.map(async (host) => {
  const sql = postgres(`postgresql://postgres.${REF}:not-the-real-password@${host}:6543/postgres`, {
    prepare: false, connect_timeout: 10, max: 1, idle_timeout: 1,
  });
  try {
    await sql`select 1`;
    return { host, verdict: 'connected (unexpected)' };
  } catch (e) {
    const m = String(e.message);
    if (/password|authentication/i.test(m)) return { host, verdict: 'MATCH' };
    return null;
  } finally { await sql.end({ timeout: 1 }); }
}));

const match = results.filter(Boolean);
if (match.length) {
  for (const m of match) console.log(`${m.verdict}: ${m.host}`);
} else {
  console.log('No pooler host matched. Copy the Transaction pooler URI from the dashboard instead.');
  process.exitCode = 1;
}
