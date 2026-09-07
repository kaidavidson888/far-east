# Deploying Far East

Next.js on Vercel, Postgres and auth on Supabase. Nothing runs on a local disk, so
there is no volume to manage and no single-machine constraint.

## 1. Create the Supabase project

Then **SQL Editor → New query**, paste all of `supabase/migrations/0001_schema.sql`,
and run it. That creates the tables, the signup trigger, and row level security.

If you prefer the CLI: `supabase link --project-ref YOUR-REF && supabase db push`.

## 2. Fill in the environment

Copy `.env.example` to `.env.local` and set three values from the Supabase dashboard:

| Variable | Where it comes from |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Project settings → API → anon/public key |
| `DATABASE_URL` | Project settings → Database → Connection string → **Transaction pooler** |

**Use the pooler on port 6543, not the direct connection on 5432.** Serverless
functions open a new connection per invocation and will exhaust Postgres in minutes
otherwise. `lib/db.ts` already sets `prepare: false`, which the pooler requires.

## 3. Seed the catalogue

```bash
npm run seed
```

Upserts all 32 entries from `lib/catalog.json`. Re-run it after any edit to that
file — it updates editorial content in place and never touches user data.

Optionally, for local development only:

```bash
npm run demo   # three reader accounts, reviews, shelves, one live share link
```

## 4. Deploy

Push to GitHub, import the repo in Vercel, and add the same three variables under
Settings → Environment Variables. Do **not** add `SUPABASE_SERVICE_ROLE_KEY` — nothing
in the deployed app uses it, and it bypasses every access control in the project.

Then set **Authentication → URL Configuration → Site URL** in Supabase to your Vercel
domain, so confirmation emails link back to the right place.

## Things that will bite you

**Email confirmation is on by default.** New accounts get no session until the user
clicks the link in their email, and `registerAction` returns "confirm your address"
rather than signing them in. To skip that during development, turn off Authentication →
Providers → Email → "Confirm email".

**Supabase's built-in email sender is rate limited** to a handful of messages an hour
and is not meant for production. Wire up a real SMTP provider before launch, or sign-ups
will start silently failing.

**RLS is on for every table, with a policy only on `cigarettes`.** That is deliberate.
Supabase exposes every `public` table through PostgREST using the anon key, which ships
to the browser; the app never reads through PostgREST — it talks to Postgres directly,
which bypasses RLS — so denying PostgREST access everywhere except the public catalogue
is the safe default. **If you later add client-side Supabase queries, they will return
nothing until you write the matching policies.** That is the failure mode to expect.

**Ownership is enforced in SQL, not by RLS.** Because the app connects as the database
owner, every mutation in `lib/db.ts` is scoped by `user_id` in the query itself. Keep
that invariant — dropping a `WHERE user_id = ...` would expose other people's data with
nothing to catch it.

**Back up.** Supabase's free tier keeps daily backups for 7 days; paid plans do
point-in-time recovery. Turn it on before you have users worth losing.

## Verifying a schema change

```bash
npm run verify:db
```

Boots a throwaway Postgres, applies `supabase/migrations/0001_schema.sql`, seeds the
catalogue, and exercises every query in `lib/db.ts` — aggregates, facet filters, CJK
search, the review upsert, share snapshots and cascade deletes. 23 checks, no network
and no Supabase project needed. Run it after touching the schema or the data layer.

It stands in a minimal `auth.users` table, since that one is Supabase's. Everything
downstream of it is the real thing.
