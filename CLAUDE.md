# Far East — instructions for Claude Code

Read HANDOFF.md first for the full story. This file is the short operating manual.

## What this is
A cigarette catalogue and review site. **Every score comes from readers; there is no
editorial rating.** Browsing, reviews, ratings and shared shelves are readable with no
account. An account adds rating, reviewing, and a shelf shareable by snapshot link.
Design system: `DESIGN-far-east.md` (brand spec supplied by the owner — follow it).

## Stack
Next.js 15 (App Router) · React 19 · Supabase Postgres via `postgres.js` (hand-written SQL,
NOT PostgREST) · Supabase Auth via `@supabase/ssr` · Server Actions for every mutation ·
no CSS framework (tokens in `app/globals.css`). Deploys to Vercel.

## Commands
- `npm run dev` — local server (needs `.env.local`, see below)
- `npm run build` — must stay clean; run it before every commit
- `npm run verify:db` — 29 checks against a throwaway Postgres (no network, no Supabase). Run after any schema or `lib/db.ts` change. It boots its own Postgres via `embedded-postgres`.
- `npm run seed` — upserts `lib/catalog.json` into the database (idempotent; never touches user data)
- `npm run link-supabase` / `set-db-password` / `diagnose-db` — configure `.env.local` safely (hidden prompts, connection tested before saving, refuse piped input)
- `npm run demo` — three sample accounts, LOCAL ONLY; needs the secret key

## Environment (`.env.local`, gitignored — never commit, never paste into chat)
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `DATABASE_URL`.
`DATABASE_URL` must be the **transaction pooler on port 6543** (serverless exhausts direct
connections). Set values with the scripts above, not by hand-editing — a stale TextEdit buffer
overwrote this file twice during setup. `.env.example` is the template.

## Invariants — do not break these
- **Ownership is enforced in SQL, not RLS.** The app connects as the DB owner and bypasses RLS,
  so every mutation in `lib/db.ts` is scoped by `user_id` in the query. Dropping a
  `WHERE user_id = ...` exposes other people's data with nothing to catch it.
- **RLS is ON for every table, with a policy only on `cigarettes`.** Supabase exposes `public`
  tables via PostgREST with the browser-visible key; this denies that by default. The Data API is
  also disabled in the project. If you add client-side Supabase queries they return nothing until
  you write policies — that is deliberate, not a bug.
- **Row ids are numbers.** Postgres returns `bigint` as strings by default; `lib/db.ts` parses
  int8 to Number and `hydrate()` coerces `id`. Ids are used as Map keys and compared with `===`;
  a string id silently makes shelves render empty. `verify:db` guards this.
- **A share link is a frozen snapshot** (`shares` + `share_items`) of the shelf at generation
  time, including the owner's rating and note. One live link per user (partial unique index).
  Cancelling soft-revokes (`revoked_at`); a cancelled link renders "no longer active", never 404.
- **`slug` is permanent identity.** Reviews and favourites reference the product row; changing
  a slug in `lib/catalog.json` creates a new product and orphans its data.
- **Design rules from the spec:** border-radius 0 everywhere except icon buttons/avatars; scores
  are never colour-graded; red (`--negative`) is never an error colour — it is warm grey.
  Exception the owner chose: cinnabar is also the "Add to my shelf" CTA (the primary action).
- Dates are formatted server-side in `lib/format.ts` (`en-US`, `America/New_York`) and passed
  as strings — never re-format on the client.

## Known gaps / open work (priority order)
1. **Deploy is not yet green.** See HANDOFF.md → Deployment. The middleware was removed to get
   past `MIDDLEWARE_INVOCATION_FAILED`; that commit (`f6b03ff`) still needs pushing.
2. **No session refresh on plain page loads** (middleware removed). Readers who only browse are
   signed out ~1h after login; server actions keep active sessions alive. Fix: a Node-runtime
   route handler (`/auth/refresh`) that calls `getUser()` and persists cookies, pinged from a
   tiny client component near token expiry. Plan is in `lib/supabase/server.ts`.
3. **Product images are a placeholder** (`components/PackShot.tsx`). Plan: `public/products/<slug>.jpg`,
   card uses it when present, falls back to the SVG. See HANDOFF.md.
4. **Real product data pending** — owner has `import/catalog-template.csv`; write an importer
   (CSV → `lib/catalog.json` → `npm run seed`). Four columns are constrained to the filter
   values in `lib/seed.ts`.
5. **Instagram link is a placeholder** — two constants at the top of `app/page.tsx`.
6. `subscribers` table is unused (newsletter removed); drop it in a migration when convenient.

## Gotchas learned the hard way
- Run `next build` only with the dev server stopped; both write to `.next`.
- Restarting the dev server invalidates Server Action ids in open tabs → `POST 404`; hard-refresh.
- The Vercel project must be owned by the same GitHub account as the repo (`kaidavidson888`) on
  the Hobby plan, and commits should be authored by that account (repo-local git identity is set).
- `far-east.vercel.app` is NOT this project (someone else's site). Production is `far-east-beta.vercel.app`.
- If the live domain serves `/logos/*.svg` (200) but `/` and `/_next/static/*` are 404, the
  Vercel project's Framework Preset is not "Next.js" — it is serving `public/` as a static site.
- Verifying signed-in UI: `.verify/temp-user.mjs` creates a throwaway auth user directly in
  Postgres (then `delete`). Never use real credentials for tests; the tools refuse piped input.
