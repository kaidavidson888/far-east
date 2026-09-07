# Far East — handoff

Written 7 September 2026 for Kai, taking over from Fanny. `CLAUDE.md` is the short operating
manual and is loaded automatically by Claude Code; this file is the story and the current state.

## What it is
A catalogue of 32 cigarettes from ten markets with reader ratings, reviews, a personal shelf,
and shareable shelf snapshots. The brand and design system were supplied by the owner
(`DESIGN-far-east.md`, `logos/`) and the site is built to that spec. Everything is readable
without an account; an account adds rating, reviewing and a shelf.

## Access you need (confirm before doing anything)
- **GitHub** — `kaidavidson888/far-east` (private). You own it.
- **Vercel** — project `far-east`, Hobby plan, signed in as `kaidavidson888`. Production
  domain `far-east-beta.vercel.app`. (`far-east.vercel.app` is a stranger's site — ignore it.)
- **Supabase** — project ref `cszctbpkadrpgazppsev` (East US, N. Virginia). Created under a
  "new account" during the migration — check it is yours or get invited as an owner.
- **Secrets** — three values in `.env.local`. They must be handed over via a password manager,
  never chat. **The database password appeared in the previous owner's chat transcript and
  terminal history more than once — treat the current one as compromised and rotate it
  (Supabase → Project Settings → Database → Reset) before relying on it, then update it in
  Vercel's env vars and locally with `npm run set-db-password`.**

## Current state — read this carefully
- **Code:** GitHub `main` is at `ab60121` and matches the zip. That includes `f6b03ff`
  (middleware removed) and these handoff docs. Clone from GitHub; the zip is a fallback.
- **Live site:** after that push, `far-east-beta.vercel.app` returns **404** (no deployment
  serving) rather than the earlier 500. Whether the `ab60121` build is Ready, Blocked or
  Errored was **not confirmed** at handoff — check the Deployments list in Vercel first.
  **The site has never successfully deployed.**
- **Database:** schema applied (7 tables, RLS on, both migrations), catalogue seeded
  (32 rows), one registered account, no favourites or reviews yet.
- **Verification:** `npm run verify:db` is 29/29 against a real Postgres. Signed-in UI paths
  (shelf, share link, sign-in/out) were verified in a browser against the live database.
  The production build is clean.

## Deployment — where it got stuck
1. Two deployments were **Blocked** with "commit author did not have contributing access…
   Hobby does not support collaboration for private repositories." Root cause was a
   two-account split: repo under `kaidavidson888`, Vercel signed in as `fanny-c-davidson`.
   Resolved by signing into Vercel as `kaidavidson888`. The repo's git identity is now set to
   `kaidavidson888` so future commits match.
2. The first build that ran crashed with **`MIDDLEWARE_INVOCATION_FAILED`**. The middleware
   (`middleware.ts` + `lib/supabase/middleware.ts`) refreshed the Supabase session via
   `@supabase/ssr`. Wrapping its body in try/catch did not help. It could not be reproduced
   locally, in `next start`, or by loading the compiled bundle into Vercel's published
   `edge-runtime` package. It was **removed** in `f6b03ff` to unblock.
3. **Unconfirmed:** whether the `f6b03ff`/`ab60121` builds succeeded or were Blocked. Look at
   the deployment's **status** in the Deployments list, not the URL — a 404 there just means
   no Ready deployment is attached to the domain.

4. After `ab60121` the domain served Vercel's own **`NOT_FOUND`** for `/` and `/catalog` while
   `/logos/*.svg` returned 200 and `/_next/static/*` returned 404 — i.e. the deployment was
   **static-only: `public/` served with no Next.js output**. Cause: the Vercel project was
   created before the repo had code, so Next.js was never auto-detected and the Framework
   Preset stayed "Other". Fix: Project Settings → Build and Deployment → Framework Preset =
   **Next.js**, Build Command / Output Directory / Root Directory left at defaults, then
   Redeploy. Diagnostic: if static files 200 and app routes 404, it is this.

If a build is still **Blocked** after all of the above, the remaining Hobby-plan fix is to make
the repo public (it contains no secrets — verified by scanning history) or upgrade to Pro.

**Consequence of removing the middleware:** a token refreshed during a plain page render
cannot be persisted from a server component, so a reader who only browses is signed out about
an hour after login. Server actions (rate, shelve, share) still write cookies and keep active
sessions alive. Proper fix: a Node-runtime `/auth/refresh` route handler that calls
`getUser()` and persists cookies, pinged from a small client component near expiry. If you
find the Edge crash instead, restoring the middleware is the cleaner solution.

## Decisions and why (chronological)
- **SQLite → Supabase.** Started on local SQLite for zero setup; migrated before handoff on
  the reasoning that migrating a data layer nobody has built on is far cheaper than later.
- **Direct SQL (`postgres.js`), not PostgREST.** The catalogue needs window functions,
  aggregates and multi-facet filters; that reads better as SQL. Cost: the app bypasses RLS, so
  ownership lives in the queries (see CLAUDE.md invariants).
- **Data API disabled in Supabase**, RLS on everything, one public read policy on `cigarettes`.
- **Editorial scoring removed.** The site originally had a house score, sub-scores, "tested N
  days" stamps and a Seal of Approval. Owner decided ratings are reader-only. Written verdicts
  and pros/cons were kept as "Our notes". Editorial values remain in `lib/catalog.json` but
  are no longer seeded or in the schema (`0002_user_ratings.sql`).
- **Share links are snapshots**, not live views; one live link per user; cancel soft-revokes.
- **"Add to my shelf" is the primary cinnabar CTA everywhere** (owner's call, overriding the
  spec's "cinnabar means judged"). Saved state renders as an outline so a shelf page isn't a
  wall of red.
- **Shelf is named after the user** (no editable title). Nav: Full Catalogue · My Shelf (with
  count badge, always visible on mobile) · person icon (desktop only; burger on mobile).
- **Dates:** US format, pinned to `America/New_York`, formatted server-side.
- **Newsletter replaced by an Instagram band** (placeholder URL/handle in `app/page.tsx`).
- **Session splash** (`components/SplashScreen.tsx`): the stacked mark on the canvas, held
  ~1.1s then faded out, shown once per browser session (`sessionStorage`), skipped under
  `prefers-reduced-motion`, click to skip. Mirrors `AgeGate` (nothing in the SSR HTML;
  decided on hydration). Came from a Figma "login/splash" mock; the mock's off-white ground
  was dropped for `--canvas` so the reveal doesn't flash light-to-dark.
- **Node:** pinned to 24 (`.nvmrc` = `24`, `engines.node` = `24.x`). Vercel ignores `.nvmrc`
  and reads `engines.node`; the old `>=20.9` range mapped to "latest 24.x" on Vercel anyway
  (their default), so local and deploy now agree explicitly. Vercel deprecates Node 20 on
  1 Oct 2026, so 24 is also the forward-looking choice. Set the Vercel Project Settings →
  Node.js Version dropdown to 24.x as well (belt and braces; `engines` already wins).
  Next 15 rather than 16 because the original machine was on Node 18 — upgrading to Next 16
  is reasonable now.

## Collaboration model (decided 7 Sep 2026)
Fanny and Kai both work locally with their own Claude Code sessions and sync through GitHub.
The repo is being made **public** so Vercel Hobby accepts commits from either of them (Hobby
blocks non-owner commits on private repos). Full history was scanned before flipping: no
credentials in any commit. Consequences: no secrets ever, and `logos/`, `DESIGN-far-east.md`
and the review text are public. The workflow rules live in `CLAUDE.md` → "Working as a team".

## Next steps, in order
1. Get a **Ready** deployment. Push `f6b03ff`, check status, apply the fallbacks above.
2. Set Supabase → Authentication → URL Configuration → Site URL to the Vercel domain.
   Decide on email confirmation (on = needs custom SMTP before real users; Supabase's built-in
   sender is rate-limited and unbranded).
3. Restore session refresh (route handler or a working middleware).
4. Product data: owner will fill `import/catalog-template.csv`; write the importer.
5. Product images: `public/products/<slug>.jpg` with SVG fallback.
6. Instagram link. Drop the unused `subscribers` table.

## Things not to do
- Don't hand-edit `.env.local` in TextEdit; use the scripts. Don't pipe secrets into them.
- Don't run `next build` while `next dev` is running (shared `.next`).
- Don't add `SUPABASE_SECRET_KEY` to Vercel. Nothing deployed uses it.
- Don't scale past the transaction pooler / don't switch `DATABASE_URL` to port 5432.
- Don't change existing slugs in `catalog.json`.
