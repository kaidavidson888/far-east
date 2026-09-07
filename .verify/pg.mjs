import EmbeddedPostgres from 'embedded-postgres';

export async function boot() {
  const pg = new EmbeddedPostgres({
    databaseDir: '/tmp/fe-pgdata',
    user: 'postgres', password: 'postgres',
    port: 54329, persistent: false,
    initdbFlags: ['--encoding=UTF8', '--lc-collate=C', '--lc-ctype=C'],
  });
  await pg.initialise();
  await pg.start();
  try { await pg.createDatabase('fareast'); } catch { /* already there */ }
  return pg;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await boot();
  console.log('postgres up on 54329, db=fareast');
  await new Promise(() => {});
}
