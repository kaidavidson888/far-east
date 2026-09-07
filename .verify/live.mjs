// Exercises the REAL compiled lib/db.ts against the live database, read-only.
import '../scripts/load-env.mjs';
import postgres from 'postgres';
import { favoritesWithNotes, favoriteIds, listCigarettes, getCigarettesByIds } from './build/db.js';

const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 2 });
const [{ id: uid }] = await sql`SELECT id FROM profiles LIMIT 1`;
await sql.end();

const ids = await favoriteIds(uid);
console.log('favoriteIds()          :', ids, `(types: ${[...new Set(ids.map(i => typeof i))].join(',')})`);

const byIds = await getCigarettesByIds(ids);
console.log('getCigarettesByIds()   :', byIds.length, 'resolved →', byIds.map(c => c.name).join(' | ') || '(none)');

const shelf = await favoritesWithNotes(uid);
console.log('favoritesWithNotes()   :', shelf.length, 'items →', shelf.map(s => s.cigarette.name).join(' | ') || '(none)');

const all = await listCigarettes({ sort: 'score' });
console.log('listCigarettes()       :', all.length, '| first id type:', typeof all[0]?.id);

const set = new Set(ids);
const marked = all.filter(c => set.has(c.id));
console.log('catalogue "On my shelf":', marked.length, 'of', ids.length, 'shown as saved');
console.log(marked.length === ids.length && ids.length > 0 ? '\n✓ FIXED' : '\n✗ still broken');
process.exit(0);
