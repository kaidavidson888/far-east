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
- **Homepage splash** (`components/SplashScreen.tsx` + `lib/splashFrames.ts` +
  `components/splash/SplashLoginFields.tsx`): a white full-screen overlay on `/` (every visit,
  no `sessionStorage`). The seal is a press-and-hold button (hit area = the seal's square).
  Hold to grow the login animation forward, release to retract, hold the full 4s to latch on
  the last frame with a real `loginAction` form (redirects to `/`); re-press mid-retract
  resumes forward. `prefers-reduced-motion` → one press jumps straight to the form.
  - **Frames** are pre-baked by `npm run build:splash` (`scripts/build-splash-frames.mjs`):
    decodes `scripts/assets/login-source.gif`, recolours (red → `#FF0000`, black → `#000`,
    white kept), sharpens, ramps the seal down as it drains and the clouds up to 100%, writes
    `public/splash/frames/f000..f100.webp` — the frames keep the login box's **red** outline
    but **none of its black**: the labels, ☁ glyphs and dashed lines are stripped out of every
    frame (`INK_GATE`), because the overlay fades them back in instead. The strip is the box
    inset by 4% so the outline survives, and it starts at frame 30 — the 遠東 seal drains
    through the same rectangle and the inset box holds exactly zero black at frames 30-32, so
    the gate lands in a real gap. Also writes:
    `edge.webp` (the final red pattern, box reflected over — tiles horizontally, ~0.999 corr),
    `settle.webp` (`process(…, LAST, 0)` — the last frame with every black part at 0), and
    `blackbox.webp` (`acc` keeping only the ink → black-on-transparent, same resize+sharpen,
    cropped to `SPLASH_GEOM.box`), and `blackbox-bold.webp` (the same sprite with the ink
    dilated by a 1px round kernel **at full resolution**, before the downscale — dilating the
    215px sprite instead fills the letter counters in). The label windows draw from the bold
    sprite, so EMAIL / PASSWORD / create account·login are bold and the ☁ + dashes are not.
    Commit the output; nothing decodes a GIF at runtime.
  - **Edge fill — branching growth:** `paint()` draws the frame 1:1 in the centre, then per
    side reveals `edge.webp` tiles through a **baked** 44-band edge-coverage profile —
    `edgeProfileAt(ms, side)` from `lib/splashEdgeProfile.ts` (base64, written by
    build-splash-frames.mjs; `paint()` used to `getImageData` this every frame, which stretched
    the 4s animation to 6–20s on slower CPUs — now paint is ~0.5ms). Each side is its own
    `destination-in` offscreen pass (a whole-offscreen second pass would wipe the first). A
    `reach` ramp (`rampUp(p, .34, .98)`) grows the margins outward over the run; `inForm` →
    full. The margins composite with **`multiply`**, not `source-over`: `edge.webp` is ink on
    opaque white paper, so drawing it normally dragged that white field across the page as a
    wash. White is multiply's identity, so only the ink lands. The baked profile stores each
    band **normalised against its own fully-grown value** — raw red *density* peaks at 0.36 on
    a sparse line pattern, and feeding that straight in as mask alpha held the extensions at a
    third strength for the whole run.
    The red fingers out in the frame's own organic shape, like water, never a rectangle.
    On a phone the frame fills the width so none shows.
  - **Faint centre / bold edges:** after everything, `paint()` lays a radial veil of the page
    colour — eased in with `smooth(rampUp(p, .18, 1))`, permanent once latched. Idle: `0.34`
    alpha at the box, `0.52` in the halo, `0.05` by 72% radius, `0` at the screen edge. While
    a text field is focused (`fieldOnRef`, fed up from the form) the centre clears — `0` at the
    box, `0.12` halo — so the red outline box reads at 100%.
  - **Login box ink** — stripped from the frames, so `paint()` draws it instead, fading up on
    `boxInkAt(ms)` (`SPLASH_BOX_INK_B64`, one byte per frame: the share of the final content's
    pixels already inked in the source). It arrives exactly as the removed black would have
    spread — flat 0 until frame 30, 1.0 on the last frame. It is drawn **after** the vignette,
    unveiled, at the same rectangles and idle weights the DOM overlay uses (`SPLASH_FORM`,
    shared by both), and stops one frame after that overlay paints — so the two are the same
    pixels and the handover is silent.
  - **Login box** — `SplashLoginFields` shows nine sprite windows onto `blackbox.webp`, three
    per row: `label` x[x0..mid], `☁` x[mid..cloudX1], `line` x[x0..dashX1] (all fractions of
    the box, `SPLASH_GEOM.parts`, **measured off the black baked into f100** so the overlay is
    pixel-exact — verified 100% overlap). Offset by `OX/OY` so the content sits equidistant
    from the red frame. On latch `settle.webp` is drawn straight over the frame — baked black
    gone **at once**, no white patch — and the windows fade in ~200ms later (black first, then
    the form). Transparent `<input>`s + submit `<button>` sit on the dashes (typed text bold
    Cormorant Unicase, no caret, shrink-to-fit). Per-part opacity: idle → lines 50, labels 50,
    ☁ 100. A text field focused → all lines 100, submit row 80, every other label/☁ 10, and a
    full-screen veil with a soft radial hole at the box drops the red outside to 20 (the hole +
    the cleared vignette keep the whole ornate red frame at 100 — no hard clip). A row with
    text → its label + ☁ 0. Submit hovered/focused → its whole row 100, nothing else. Error
    text is warm grey (`--negative`), never red.
  - **Open:** gates the homepage behind a login every visit, in tension with CLAUDE.md's
    "browsing is open" — revisit. Still on branch `splash-screen`, not merged.
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
