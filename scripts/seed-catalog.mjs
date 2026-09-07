/**
 * Upserts lib/catalog.json into the cigarettes table.
 *
 *   npm run seed
 *
 * Idempotent: run it after any edit to catalog.json to update editorial content
 * in place. It never touches profiles, reviews, favourites or shares.
 */
import './load-env.mjs';
import postgres from 'postgres';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set. See .env.example.');
  process.exit(1);
}

const catalog = JSON.parse(
  readFileSync(path.join(process.cwd(), 'lib', 'catalog.json'), 'utf8'),
);

const sql = postgres(url, { prepare: false, max: 4 });

try {
  await sql.begin(async (tx) => {
    for (const c of catalog) {
      await tx`
        INSERT INTO cigarettes (
          slug, name, cjk, brand, country, market, strength, flavour, format,
          filter_type, length_mm, tar_mg, nicotine_mg, pack_size, price_usd,
          year, summary, verdict, pros, cons
        ) VALUES (
          ${c.slug}, ${c.name}, ${c.cjk ?? null}, ${c.brand}, ${c.country},
          ${c.market}, ${c.strength}, ${c.flavour}, ${c.format}, ${c.filterType},
          ${c.lengthMm}, ${c.tarMg}, ${c.nicotineMg}, ${c.packSize}, ${c.priceUsd},
          ${c.year}, ${c.summary}, ${c.verdict},
          ${sql.json(c.pros)}, ${sql.json(c.cons)}
        )
        ON CONFLICT (slug) DO UPDATE SET
          name = EXCLUDED.name, cjk = EXCLUDED.cjk, brand = EXCLUDED.brand,
          country = EXCLUDED.country, market = EXCLUDED.market,
          strength = EXCLUDED.strength, flavour = EXCLUDED.flavour,
          format = EXCLUDED.format, filter_type = EXCLUDED.filter_type,
          length_mm = EXCLUDED.length_mm, tar_mg = EXCLUDED.tar_mg,
          nicotine_mg = EXCLUDED.nicotine_mg, pack_size = EXCLUDED.pack_size,
          price_usd = EXCLUDED.price_usd, year = EXCLUDED.year,
          summary = EXCLUDED.summary, verdict = EXCLUDED.verdict,
          pros = EXCLUDED.pros, cons = EXCLUDED.cons
      `;
    }
  });
  const [{ n }] = await sql`SELECT COUNT(*)::int AS n FROM cigarettes`;
  console.log(`Catalogue seeded — ${n} cigarettes.`);
} finally {
  await sql.end();
}
