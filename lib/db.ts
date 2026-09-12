import 'server-only';
import postgres from 'postgres';

/**
 * Direct SQL against the Supabase Postgres instance.
 *
 * Data access happens only in server components and server actions, so this
 * connects as the database owner and bypasses RLS; ownership is enforced in the
 * queries themselves (every mutation is scoped by user_id). PostgREST access is
 * separately locked down by RLS — see supabase/migrations/0001_schema.sql.
 */
const g = globalThis as unknown as { __feSql?: postgres.Sql };

/**
 * The connection is created on first use, not at import. `next build` imports
 * every route module to collect its config, and must not need a database to
 * do so.
 */
export function db(): postgres.Sql {
  if (g.__feSql) return g.__feSql;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      'DATABASE_URL is not set. Copy .env.example to .env.local and fill in the ' +
      'Supabase connection string (Project settings → Database → Connection string).',
    );
  }

  g.__feSql = postgres(connectionString, {
    // Supabase's transaction pooler (port 6543) does not support prepared
    // statements. Serverless deploys must use it, so this is off everywhere.
    prepare: false,
    types: {
      // int8 (bigint) arrives as a string by default. Every bigint here is a
      // row id well inside Number.MAX_SAFE_INTEGER, and ids are used as Map
      // keys and compared with ===, so a string would silently never match.
      bigint: { to: 20, from: [20], serialize: String, parse: Number },
    },
    max: Number(process.env.PG_POOL_MAX ?? 10),
    idle_timeout: 20,
    connect_timeout: 10,
  });
  return g.__feSql;
}

/* ---------- Types ---------- */
export type Cigarette = {
  id: number; slug: string; name: string; cjk: string | null;
  brand: string; country: string; market: string;
  strength: string; flavour: string; format: string; filter_type: string;
  length_mm: number; tar_mg: number; nicotine_mg: number; pack_size: number;
  price_usd: number; year: number;
  summary: string; verdict: string;
  pros: string[]; cons: string[];
  /** The score. There is no editorial rating — readers are the only source. */
  userAvg: number | null; userCount: number;
};

export type ReviewRow = {
  id: number; rating: number; title: string; body: string;
  created_at: string; updated_at: string;
  user_id: string; display_name: string;
  cigarette_id: number; slug?: string; cig_name?: string; brand?: string;
};

/** count() and avg() come back as strings from the driver; normalise here. */
function hydrate(row: Record<string, unknown>): Cigarette {
  const { user_avg, user_count, ...rest } = row;
  return {
    ...(rest as Omit<Cigarette, 'userAvg' | 'userCount'>),
    // Belt and braces alongside the int8 parser: id is used as a Map key and
    // compared with ===, so it must be a number on every path.
    id: Number(rest.id),
    userAvg: user_avg === null || user_avg === undefined ? null : Number(user_avg),
    userCount: Number(user_count ?? 0),
  };
}

/**
 * Catalogue row plus its reader aggregates. Kept as one fragment so the list,
 * detail and by-id queries cannot drift apart.
 */
const selectCigarettes = (sql: postgres.Sql): Fragment => sql`
  SELECT c.*,
         ROUND(AVG(r.rating), 1)::float8 AS user_avg,
         COUNT(r.id)::int                AS user_count
  FROM cigarettes c
  LEFT JOIN reviews r ON r.cigarette_id = c.id
`;

/* ---------- Catalogue ---------- */
export type CatalogQuery = {
  q?: string;
  country?: string[]; brand?: string[]; strength?: string[];
  flavour?: string[]; format?: string[]; filterType?: string[];
  maxTar?: number;
  sort?: string;
};

/** A composable SQL fragment produced by the sql`` tag. */
type Fragment = ReturnType<postgres.Sql>;

/** Whitelisted sort fragments — never interpolate an ORDER BY from user input. */
function sortFragment(sql: postgres.Sql, key: string | undefined): Fragment {
  const sorts: Record<string, Fragment> = {
    // Unrated products sort last rather than first, which a plain DESC would do.
    rating:     sql`COALESCE(ROUND(AVG(r.rating), 1), -1) DESC, COUNT(r.id) DESC, c.name ASC`,
    reviews:    sql`COUNT(r.id) DESC, COALESCE(ROUND(AVG(r.rating), 1), -1) DESC, c.name ASC`,
    name:       sql`c.name ASC`,
    tar_asc:    sql`c.tar_mg ASC, c.name ASC`,
    tar_desc:   sql`c.tar_mg DESC, c.name ASC`,
    price_asc:  sql`c.price_usd ASC, c.name ASC`,
    price_desc: sql`c.price_usd DESC, c.name ASC`,
  };
  return sorts[key ?? 'rating'] ?? sorts.rating;
}

export async function listCigarettes(query: CatalogQuery = {}): Promise<Cigarette[]> {
  const sql = db();
  const clauses: Fragment[] = [];

  if (query.q?.trim()) {
    const like = `%${query.q.trim()}%`;
    clauses.push(sql`(
      c.name ILIKE ${like} OR c.brand ILIKE ${like} OR c.country ILIKE ${like}
      OR c.summary ILIKE ${like} OR COALESCE(c.cjk, '') ILIKE ${like}
    )`);
  }

  const facets: [string[] | undefined, Fragment][] = [
    [query.country, sql`c.country`], [query.brand, sql`c.brand`],
    [query.strength, sql`c.strength`], [query.flavour, sql`c.flavour`],
    [query.format, sql`c.format`], [query.filterType, sql`c.filter_type`],
  ];
  for (const [values, column] of facets) {
    if (values?.length) clauses.push(sql`${column} = ANY(${values})`);
  }

  if (typeof query.maxTar === 'number' && !Number.isNaN(query.maxTar)) {
    clauses.push(sql`c.tar_mg <= ${query.maxTar}`);
  }

  const where = clauses.length
    ? clauses.reduce((acc, clause) => sql`${acc} AND ${clause}`)
    : null;

  const rows = await sql`
    ${selectCigarettes(sql)}
    ${where ? sql`WHERE ${where}` : sql``}
    GROUP BY c.id
    ORDER BY ${sortFragment(sql, query.sort)}
  `;
  return rows.map((r) => hydrate(r as Record<string, unknown>));
}

export async function getCigaretteBySlug(slug: string): Promise<Cigarette | null> {
  const sql = db();
  const rows = await sql`
    ${selectCigarettes(sql)} WHERE c.slug = ${slug} GROUP BY c.id
  `;
  return rows.length ? hydrate(rows[0] as Record<string, unknown>) : null;
}

export async function getCigarettesByIds(ids: number[]): Promise<Cigarette[]> {
  const sql = db();
  if (!ids.length) return [];
  const rows = await sql`
    ${selectCigarettes(sql)} WHERE c.id = ANY(${ids}) GROUP BY c.id
  `;
  const byId = new Map(rows.map((r) => [Number(r.id), hydrate(r as Record<string, unknown>)]));
  return ids.map((id) => byId.get(id)).filter(Boolean) as Cigarette[];
}

export async function facetCounts(): Promise<Record<string, Record<string, number>>> {
  const sql = db();
  const rows = await sql<{ facet: string; value: string; n: number }[]>`
    SELECT 'country'    AS facet, country     AS value, COUNT(*)::int AS n FROM cigarettes GROUP BY country
    UNION ALL
    SELECT 'brand',     brand,       COUNT(*)::int FROM cigarettes GROUP BY brand
    UNION ALL
    SELECT 'strength',  strength,    COUNT(*)::int FROM cigarettes GROUP BY strength
    UNION ALL
    SELECT 'flavour',   flavour,     COUNT(*)::int FROM cigarettes GROUP BY flavour
    UNION ALL
    SELECT 'format',    format,      COUNT(*)::int FROM cigarettes GROUP BY format
    UNION ALL
    SELECT 'filterType', filter_type, COUNT(*)::int FROM cigarettes GROUP BY filter_type
  `;
  const out: Record<string, Record<string, number>> = {};
  for (const r of rows) {
    (out[r.facet] ??= {})[r.value] = Number(r.n);
  }
  return out;
}

/* ---------- Reviews ---------- */
export async function reviewsForCigarette(cigaretteId: number): Promise<ReviewRow[]> {
  const sql = db();
  return await sql<ReviewRow[]>`
    SELECT r.*, p.display_name
    FROM reviews r JOIN profiles p ON p.id = r.user_id
    WHERE r.cigarette_id = ${cigaretteId}
    ORDER BY r.updated_at DESC
  `;
}

export async function reviewByUser(userId: string, cigaretteId: number): Promise<ReviewRow | null> {
  const sql = db();
  const rows = await sql<ReviewRow[]>`
    SELECT r.*, p.display_name
    FROM reviews r JOIN profiles p ON p.id = r.user_id
    WHERE r.user_id = ${userId} AND r.cigarette_id = ${cigaretteId}
  `;
  return rows[0] ?? null;
}

export async function reviewsByUser(userId: string): Promise<ReviewRow[]> {
  const sql = db();
  return await sql<ReviewRow[]>`
    SELECT r.*, p.display_name, c.slug, c.name AS cig_name, c.brand
    FROM reviews r
    JOIN profiles p ON p.id = r.user_id
    JOIN cigarettes c ON c.id = r.cigarette_id
    WHERE r.user_id = ${userId}
    ORDER BY r.updated_at DESC
  `;
}

export async function upsertReview(
  userId: string, cigaretteId: number, rating: number, title: string, body: string,
) {
  const sql = db();
  await sql`
    INSERT INTO reviews (user_id, cigarette_id, rating, title, body)
    VALUES (${userId}, ${cigaretteId}, ${rating}, ${title}, ${body})
    ON CONFLICT (user_id, cigarette_id) DO UPDATE SET
      rating = EXCLUDED.rating, title = EXCLUDED.title,
      body = EXCLUDED.body, updated_at = NOW()
  `;
}

export async function deleteReview(userId: string, cigaretteId: number) {
  const sql = db();
  await sql`DELETE FROM reviews WHERE user_id = ${userId} AND cigarette_id = ${cigaretteId}`;
}

export async function recentReviews(limit = 6): Promise<ReviewRow[]> {
  const sql = db();
  return await sql<ReviewRow[]>`
    SELECT r.*, p.display_name, c.slug, c.name AS cig_name, c.brand
    FROM reviews r
    JOIN profiles p ON p.id = r.user_id
    JOIN cigarettes c ON c.id = r.cigarette_id
    ORDER BY r.updated_at DESC
    LIMIT ${limit}
  `;
}

/* ---------- Favourites ---------- */
export async function favoriteIds(userId: string): Promise<number[]> {
  const sql = db();
  const rows = await sql<{ cigarette_id: number }[]>`
    SELECT cigarette_id FROM favorites WHERE user_id = ${userId} ORDER BY created_at DESC
  `;
  return rows.map((r) => Number(r.cigarette_id));
}

/** Just the tally, for the nav badge — cheaper than fetching every id. */
export async function favoriteCount(userId: string): Promise<number> {
  const sql = db();
  const [row] = await sql<{ n: number }[]>`
    SELECT COUNT(*)::int AS n FROM favorites WHERE user_id = ${userId}
  `;
  return Number(row?.n ?? 0);
}

export async function favoritesWithNotes(
  userId: string,
): Promise<{ cigarette: Cigarette; note: string; created_at: string }[]> {
  const sql = db();
  const rows = await sql<{ note: string; created_at: string; cigarette_id: number }[]>`
    SELECT note, created_at, cigarette_id
    FROM favorites WHERE user_id = ${userId} ORDER BY created_at DESC
  `;
  const cigs = await getCigarettesByIds(rows.map((r) => Number(r.cigarette_id)));
  const byId = new Map(cigs.map((c) => [c.id, c]));
  return rows
    .filter((r) => byId.has(Number(r.cigarette_id)))
    .map((r) => ({
      cigarette: byId.get(Number(r.cigarette_id))!,
      note: r.note,
      created_at: r.created_at,
    }));
}

/** Returns true if the cigarette is now on the shelf. */
export async function toggleFavorite(userId: string, cigaretteId: number): Promise<boolean> {
  const sql = db();
  const removed = await sql`
    DELETE FROM favorites
    WHERE user_id = ${userId} AND cigarette_id = ${cigaretteId}
    RETURNING id
  `;
  if (removed.length) return false;

  await sql`
    INSERT INTO favorites (user_id, cigarette_id, note)
    VALUES (${userId}, ${cigaretteId}, '')
    ON CONFLICT (user_id, cigarette_id) DO NOTHING
  `;
  return true;
}

export async function setFavoriteNote(userId: string, cigaretteId: number, note: string) {
  const sql = db();
  await sql`
    UPDATE favorites SET note = ${note}
    WHERE user_id = ${userId} AND cigarette_id = ${cigaretteId}
  `;
}

/* ---------- Who already has an account ---------- */

/**
 * What the splash needs to know about an email before it decides what to do.
 *
 * Supabase deliberately gives no way to ask "does this address have an
 * account" — that is an enumeration endpoint and they will not build one. This
 * reads the auth schema directly, which it can because the app connects as the
 * database owner. It is the only place outside supabase/migrations that touches
 * `auth.` anything, and it reads: no writes, and nothing about the password,
 * which is bcrypt in `auth.users.encrypted_password` and is never read, logged
 * or copied anywhere by this application.
 *
 * `googleLinked` is what makes "verify with Google once" stick. An account can
 * exist with a password and no Google identity — somebody signed up and then
 * closed the tab on Google's screen — and that account is not finished. The
 * splash sends them back to Google rather than letting them in.
 *
 * NOTE that telling an existing address apart from a new one is exactly what
 * account enumeration is, and the owner asked for it so the two cases can look
 * different in the box. See CLAUDE.md.
 */
export type AccountState = { exists: boolean; googleLinked: boolean };

export async function accountState(email: string): Promise<AccountState> {
  const sql = db();
  const [row] = await sql<{ google: boolean }[]>`
    SELECT EXISTS (
      SELECT 1 FROM auth.identities i
      WHERE i.user_id = u.id AND i.provider = 'google'
    ) AS google
    FROM auth.users u
    WHERE lower(u.email) = lower(${email})
    LIMIT 1
  `;
  return { exists: Boolean(row), googleLinked: Boolean(row?.google) };
}

/* ---------- The pack shelf ----------
 * The bookmark on a cigarette's own page, which is a different shelf from the
 * one above. `favorites` keys on a catalogue row and the catalogue is still
 * 32 placeholder products; these 235 pages are the owner's own vectors, keyed
 * by the pack's source filename. See supabase/migrations/0003_pack_favorites.sql
 * for why they are not the same table.
 *
 * The id saved is the PAGE's, not the pressed pack's, so the twelve packs that
 * share a name with another save as the one cigarette they are.
 */

/** Whether this reader has already bookmarked this page. */
export async function packIsSaved(userId: string, packId: string): Promise<boolean> {
  const sql = db();
  const [row] = await sql<{ one: number }[]>`
    SELECT 1 AS one FROM pack_favorites
    WHERE user_id = ${userId} AND pack_id = ${packId}
  `;
  return Boolean(row);
}

/**
 * Bookmark a page. Add-only and idempotent: the owner asked for the mark to
 * go red permanently, so pressing it again is not an undo, and a double
 * submit cannot make a second row.
 */
export async function savePack(userId: string, packId: string): Promise<void> {
  const sql = db();
  await sql`
    INSERT INTO pack_favorites (user_id, pack_id)
    VALUES (${userId}, ${packId})
    ON CONFLICT (user_id, pack_id) DO NOTHING
  `;
}

/** Everything on this reader's pack shelf, most recently saved first. */
export async function savedPackIds(userId: string): Promise<string[]> {
  const sql = db();
  const rows = await sql<{ pack_id: string }[]>`
    SELECT pack_id FROM pack_favorites
    WHERE user_id = ${userId} ORDER BY created_at DESC
  `;
  return rows.map((r) => r.pack_id);
}

/* ---------- Profiles ---------- */
export type Profile = { id: string; display_name: string; created_at: string };

export async function profileById(id: string): Promise<Profile | null> {
  const sql = db();
  const rows = await sql<Profile[]>`SELECT * FROM profiles WHERE id = ${id}`;
  return rows[0] ?? null;
}

/* ---------- Shares (snapshot links) ---------- */
export type Share = {
  id: number; token: string; user_id: string;
  created_at: string; revoked_at: string | null;
};

export type ShareItem = {
  cigarette: Cigarette;
  note: string;
  rating: number | null;
  review_title: string;
};

export async function activeShare(userId: string): Promise<Share | null> {
  const sql = db();
  const rows = await sql<Share[]>`
    SELECT * FROM shares WHERE user_id = ${userId} AND revoked_at IS NULL
  `;
  return rows[0] ?? null;
}

export async function shareByToken(token: string): Promise<Share | null> {
  const sql = db();
  const rows = await sql<Share[]>`SELECT * FROM shares WHERE token = ${token}`;
  return rows[0] ?? null;
}

/**
 * Freezes the shelf as it stands. Any previous link is revoked first, so a
 * person has at most one live link at a time.
 */
export async function createShare(userId: string, token: string): Promise<Share> {
  const sql = db();
  return await sql.begin(async (tx) => {
    await tx`
      UPDATE shares SET revoked_at = NOW()
      WHERE user_id = ${userId} AND revoked_at IS NULL
    `;
    const [share] = await tx<Share[]>`
      INSERT INTO shares (token, user_id) VALUES (${token}, ${userId}) RETURNING *
    `;
    // Snapshot the shelf: the products, the notes, and the owner's own score,
    // so the whole page reads as one moment in time.
    await tx`
      INSERT INTO share_items (share_id, cigarette_id, note, rating, review_title, position)
      SELECT ${share.id}, f.cigarette_id, f.note, r.rating, COALESCE(r.title, ''),
             ROW_NUMBER() OVER (ORDER BY f.created_at DESC)
      FROM favorites f
      LEFT JOIN reviews r ON r.user_id = f.user_id AND r.cigarette_id = f.cigarette_id
      WHERE f.user_id = ${userId}
    `;
    return share;
  }) as Share;
}

export async function revokeShare(userId: string) {
  const sql = db();
  await sql`
    UPDATE shares SET revoked_at = NOW()
    WHERE user_id = ${userId} AND revoked_at IS NULL
  `;
}

export async function shareItems(shareId: number): Promise<ShareItem[]> {
  const sql = db();
  const rows = await sql<{
    cigarette_id: number; note: string; rating: number | null; review_title: string;
  }[]>`
    SELECT cigarette_id, note, rating, review_title
    FROM share_items WHERE share_id = ${shareId} ORDER BY position
  `;
  const cigs = await getCigarettesByIds(rows.map((r) => Number(r.cigarette_id)));
  const byId = new Map(cigs.map((c) => [c.id, c]));
  return rows
    .filter((r) => byId.has(Number(r.cigarette_id)))
    .map((r) => ({
      cigarette: byId.get(Number(r.cigarette_id))!,
      note: r.note,
      rating: r.rating === null ? null : Number(r.rating),
      review_title: r.review_title,
    }));
}
