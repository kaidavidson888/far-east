import { boot } from './pg.mjs';
const t = setTimeout(() => { console.error('TIMEOUT after 75s'); process.exit(1); }, 75000);
try {
  const pg = await boot();
  clearTimeout(t);
  console.log('OK: postgres started');
  await pg.stop();
  console.log('stopped cleanly');
} catch (e) {
  clearTimeout(t);
  console.error('FAILED:', e?.message ?? e);
  process.exit(1);
}
