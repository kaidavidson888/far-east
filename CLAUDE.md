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
- `npm run build:landing` / `npm run build:pages` — normalise a page's artwork and cut it
  into `public/<page>/parts/*.svg` + `lib/<page>-geometry.json`. `build:pages` does About Us,
  Privacy Policy and Terms of Service together. Re-run after changing the matching
  `scripts/assets/*.svg`; the layouts read that geometry, so nothing is hardcoded and a
  re-export moves the buttons with the marks. See "Pages built from artwork" below.
- `npm run verify:db` — 29 checks against a throwaway Postgres (no network, no Supabase). Run after any schema or `lib/db.ts` change. It boots its own Postgres via `embedded-postgres`.
- `npm run seed` — upserts `lib/catalog.json` into the database (idempotent; never touches user data)
- `npm run link-supabase` / `set-db-password` / `diagnose-db` — configure `.env.local` safely (hidden prompts, connection tested before saving, refuse piped input)
- `npm run demo` — three sample accounts, LOCAL ONLY; needs the secret key
- `npm run build:cigs` — rebuilds the 282 pack marks in `public/cigs` and `lib/cigs.json`
  from the owner's `Cigs Images` folder (path at the top of `scripts/build-cigs.mjs`)
- `npm run build:cigpages` — rebuilds the 235 pages in `public/cigpages` and
  `lib/cigpages.json` from the owner's info-page vectors in `scripts/assets/cigpages`.
  **Takes about half an hour** (it re-encodes every raster in every vector), so background
  it. Re-run it after `build:cigs`: each page carries a copy of that pack's cleaned mark.

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

## Pages built from artwork (the landing page, About Us, Privacy Policy, Terms of Service)
The owner supplies a Figma export; the page is built from it, not hand-typeset. **The rule
the owner set: hold the design's edge margins in real CSS pixels at every viewport size.**
Elements keep their drawn size and the space between them flexes. Never scale the whole
artwork to fit a frame — that scales the margins with it, which is the thing being avoided.
- Measure margins off a *render* of the export, never off Figma layer boxes; those are
  padded (the landing logo's was a 116x116 rect mostly empty around the characters).
- `scripts/lib/split-svg-parts.mjs` cuts an export into one SVG per element, given a
  `regions` map and the page's `background`. Nodes are grouped by where they sit, not by
  index. A node matching no region, matching two, or a region catching nothing is a **hard
  error** — a silently missing mark is worse than a failed build.
- `scripts/lib/resample-embedded.mjs` brings embedded rasters down to 4x their drawn size.
  Figma exports images at full resolution: the footer icons were 46x oversampled, 640KB for
  three 54px squares. **Tune it in Chrome, never in a headless rasteriser** — resvg
  resamples far better than a browser, so it rates the untouched bitmap best and every
  re-encode a loss, which is the opposite of what ships. That mistake cost two rounds.
- `scripts/lib/page-pipeline.mjs` is the shared normalising step for the three inner pages:
  masks into defs, the logo and the "about us" label swapped for vector, footer fills set
  (the current page's button black, the other two red, label drawn after the fill), colours
  snapped. `scripts/build-pages.mjs` holds one config per page.
- **Watch for duplicated layers.** The Terms of Service export stacks two copies of its whole
  footer. Anything that rewrites an image must group by image id first, or the second pass
  measures against what the first already shrank (a 168px icon became 15px).
- `lib/artpage.ts` holds the shared layout model, `components/ArtworkPage.tsx` renders a
  spec, `lib/innerPage.ts` builds the spec the three inner pages share, and each page
  contributes one (`lib/landing.ts`, `lib/about.ts`, `lib/privacy.ts`, `lib/terms.ts`) from
  its generated geometry. CSS lives in the `.artpage-*` block in `globals.css`.
- Small labels: a 9px line of text will not render solid at DPR 1 whatever the format. Prefer
  a real vector of the label; a hairline stroke on its paths is the honest last resort.
- **Keep every part on whole pixels.** A fractional box is the quietest cause of blur: the
  part's SVG gets a fractional width, the browser reports its intrinsic size as the rounded
  integer, then draws it into the fractional CSS box — a scale of 1.0005 that resamples every
  row. The Privacy body was 295x514 intrinsic drawn into 295x514.25 and looked soft for it.
  `inkBox` rounds outward, and `ArtworkPage` rounds the centring offset — but only the mark's
  own half-width, not the `left: 50%` under it, and 50% of an odd stage width is still a .5.
  **The artwork pages are live with that half pixel today; see Known gaps.** The cigarette
  page is the one that has it right: `left: round(50%, 1px)`, with a plain `left: 50%`
  declared above it as the fallback. Measuring a part by drawing its SVG to a canvas will NOT
  catch this — the canvas draws at integer coordinates. Check `getBoundingClientRect` against
  `naturalWidth/Height` on the live page instead.
- **The logo goes home.** On every page except the landing page and the splash, the 遠東
  logo links to `/landing` (`HOME` in `lib/innerPage.ts`) — not `/`, which puts a signed-out
  reader back behind the splash. Give the logo part an `href` and `ArtworkPage` renders an
  `<a>`. This holds for pages not built yet. The landing page is the exception: there the
  logo opens the menu and is marked `decorative` so it is not also a button.
- Routes: `/` is the landing artwork behind the sign-in splash; `/landing` is the same page
  with no splash. `/about`, `/privacy`, `/terms` are the inner pages.
- **The logo menu** (`components/LogoMenu.tsx`, `npm run build:menu`) is on the landing
  routes and the cigarette pages — its ground is white, so it cannot go on the red inner
  pages. Hovering 遠東 unfolds the linked boxes; pressing mid-run skips to the end; pressing
  the logo again or anything else runs it back at 2x. Frames are baked from
  `scripts/assets/monkey-bar.gif` because a GIF cannot be seeked, paused or reversed. The
  canvas covers the page's own logo rather than replacing it — frame 0 IS that logo, and both
  put their ink at exactly 46,28, which is measured in the build, not assumed. The canvas is
  cut to the animation's own content so its white ground cannot reach the seal.
- **The menu has a fourth box the gif never drew.** The cigarette pages need a way home, and
  there the logo is the menu's switch rather than a link, so home had to be a box. It is not
  hand-drawn: the bake measured that the gif unfolds **one box every 40 frames exactly** (box
  1's connector at f51, box 2's at f91, box 3's at f131) and that each label is a **linear
  fade over its last ten frames** — the ink's extent never moves, only its darkness. So frame
  170+k is frame 169 with the strip carrying box 3's cycle (x 226..290) copied from frame
  130+k and moved 64px right, its label dropped, and the word "home" faded in at whatever
  alpha box 3's label was wearing. f169 and f170 are byte-identical, so the join is invisible.
  **`stops` in `lib/menu-geometry.json` is how a page says how far to play**: `base` is the
  170 frames the gif drew (the landing page), `home` is all 210. One set of frames, two
  lengths — do not bake a second set.
- The home label is `scripts/assets/menu-home-label.png`, a coverage map rendered **in Chrome**
  from the owner's own webfont. It has to be checked in because librsvg — which is what sharp
  rasterises SVG with — ignores an `@font-face` even with the font embedded as a data URI, and
  there is no 'h' anywhere in the three existing labels to cut one from. It is sized the way
  the owner sizes the others: every label block is ~42px wide whatever its word count, so the
  type size falls out of that (13.6px for one short word).
- The form factor is resolved server-side in `lib/device.ts` so the page arrives already
  arranged. Mobile and desktop are separate placement tables even when the values match,
  so either can be re-composed alone.
- Dev flags on these pages: `?hitboxes=1` outlines the buttons, `?device=mobile|desktop`
  forces an arrangement.

## Pages built from the owner's artwork
The landing, about, privacy and terms pages are not laid out by hand. Each is built from a
supplied export by a script in `scripts/`, which measures a *render* of the artwork (never the
Figma layer boxes — those are padded) and writes a geometry JSON that the page spec reads.

**The margin rule, which the owner set and which applies to every new image they give us:**
measure the distance from each edge of the design to the outermost ink, and hold those
distances in real CSS pixels at every viewport. Elements keep their drawn size; the space
between them flexes. Never scale the artwork to fit — that scales the margins with it, which is
the thing being avoided. Mobile and desktop get the same margins and differ only in where the
edges are. See `lib/artpage.ts`.

Two rules that cost real time to learn:
- **Tune image resampling against Chrome, not a headless rasteriser.** resvg resamples far
  better than a browser does, so anything tuned against it ships blurry.
- **Whole pixels.** A part drawn into a fractional CSS box makes the browser resample every
  row (it reports a rounded intrinsic size, then draws into the fractional box). Canvas
  measurement cannot see this because canvas draws at integer coordinates — compare
  `getBoundingClientRect` against `naturalWidth/Height` on the live page instead.

Baked animations (splash, logo menu, seal) are GIF frames rendered to WebP and scrubbed on a
canvas, because a GIF cannot be seeked, paused or reversed. `lib/useFrameScrub.ts` is the
shared state machine; `LogoMenu` still carries its own copy and should be folded into it.
Flat-coloured frames must be quantised to a fixed palette and written lossless — a lossy encode
will not keep a flat field flat, and per-frame palette choice drifts the white frame to frame.

A cigarette's own page (`/packs/<id>`, `npm run build:cigpages`) is built from
one supplied vector each, cut to a frame so centring gives it equal side margins.
**The logo and the seal are taken out of that vector by the build and placed
against the page's own edges instead**, at the landing page's geometry — the
margin rule. The vector drew its logo as a raster that read soft, and a mark
travelling with a centred body would sit somewhere different on every width. The
build also swaps the vector's own pack photograph for the cleaned one the
landing row uses, and closes the red frame onto it with no margin, which is how
the owner's vectors draw it (rect and image share one box). **The logo there is
the menu, not a link** — the menu's home box is what goes back.

**Each vector is cut twice.** The phone keeps the design as drawn — it is a
phone-shaped page to begin with — and is centred, which is what makes its side
margins equal. The **desktop** gets the owner's rearrangement: the title block
up under the logo on the landing page's own left edge, everything below it
spread down the whole page. `scripts/lib/cigpage-layout.mjs` does the moving,
and these are worth knowing before touching it:
- **It moves bands, not elements.** Each vector is a flat list of rects, images
  and texts with absolute coordinates and no ids, but all 227 lay the page out
  in the same six horizontal bands, which never interleave (surveyed: two
  shapes, differing by one rect in the ratings band). So a band's run of
  elements is wrapped in a `<g translate>` and nothing inside is retyped.
- **The frame is fixed, not measured.** A crop measured off the ink would move
  when the title moved, which would move the title: the alignment would chase
  itself. The frame is the design's own (x=39, w=304), which puts the title's
  vector x=44 at stage x=48 — the logo's 45 plus the OFFERS 3.
- **The desktop body is anchored left, not centred** (`desktop.left` = 43 in the
  manifest). It has to be: the logo is pinned to the page's edge, so a centred
  column would carry the title away from it the moment the window grew, and
  being under the logo is the whole point of the arrangement. **So the desktop
  page does not have equal side margins** — the space that would have been a
  right margin flexes between the body and the seal's corner. That is a
  deliberate trade the owner chose, not an oversight; do not "fix" it by
  centring.
- The gaps between the lower bands keep their **ratio** and are stretched by a
  common factor (~2.9) to fill the page, rather than the elements being scaled:
  the content is already at the frame's full width, so scaling up would
  overflow it.

The cigarette row on the landing page is measured off two references the owner supplied, both
kept in `scripts/assets`: a positioning SVG and an MP4 of the motion. The MP4 runs at **8fps,
dead constant** — that stepping is deliberate and the owner likes it, so the row is driven by a
125ms timer rather than rAF. All of it is written up in `lib/cigRow.ts`.

## The owner's own face (`public/fonts/far-east-1.woff2`)
Supplied by the owner as `Far_East_Full_Webfont.woff2`, declared as the family
**"Far East"**, self-hosted, and reached through the `--font-typed` token.

**The rule the owner set: everything typed into this site is set in this face, in
every text field on every page, and so is any copy we write from here on** —
unless they say otherwise for a particular piece. `--font-typed` is how you ask
for it; do not name the family directly.

What is actually in the file, read out of it rather than assumed:
- **64 glyphs. Space, 0-9, A-Z, a-z, and nothing else.** No full stop, comma,
  apostrophe, hyphen, colon, @, parentheses, quotes — and no CJK. Everything
  outside that set is drawn by the next family in the stack, which is why the
  `@font-face` declares `unicode-range` exactly: the browser then never
  consults this face for a character it does not have. **If you write copy that
  leans on punctuation, look at it rendered before you ship it.**
- It is a **unicase** design — the capitals and the lowercase are largely the
  same letterforms. That is why the splash's typed rows used Cormorant *Unicase*
  as a stand-in before this arrived, and why they now use the real thing.
- One weight, `usWeightClass` 700, so the face is declared `font-weight: 400 700`
  and the fields set `font-synthesis: none` — the drawn weight at either end
  rather than a browser-smeared bold.
- 1000 upem · cap 700 · x-height 510 · mean lowercase advance 0.67em, about a
  third wider than any fallback. **Nothing can metric-match it**, so do not try:
  the file is preloaded in the document head instead and swaps within a frame.
- `fsType` is 4 (preview & print). If this font is ever licensed from someone
  else rather than the owner's own conversion, that bit is worth a look.

**The file is already as small as it goes.** Recompressing the brotli stream at
quality 11 and dropping the `post` table's glyph names together save 50 bytes of
6484 — 0.8%, for a rewritten font binary. Not worth it; it has already been
subsetted to exactly its cmap (64 glyphs, 64 codepoints, no orphans). The wins
that were left were all in delivery, and they are done: preloaded in
`app/layout.tsx` (with `crossOrigin`, which is **not** optional on a font
preload even same-origin — without it the browser fetches the file twice),
`font-display: swap`, the exact `unicode-range`, and `/fonts/:file*` served
`immutable` for a year from `next.config.mjs`. **The version is in the
filename** — bump `far-east-1` to `-2` when the file is replaced, in
`globals.css` and `app/layout.tsx` together, or caches will hold the old one.

## Working as a team (two people, two Claude Code sessions)
The repo is **public** on GitHub — chosen so Vercel Hobby deploys commits from either owner.
That means: **never commit anything sensitive** (`.env*` is gitignored; keep it that way), and
the brand assets and review text in this repo are visible to anyone.
- `git pull` before starting any work; commit small; push when a piece is done.
- Anything non-trivial goes on a short-lived branch and is merged by pull request. Prefer the
  other person merging. Don't force-push `main`.
- **Schema changes:** add a numbered file to `supabase/migrations/`, run `npm run verify:db`,
  and apply it to the shared Supabase project **once** (the author does it, in the SQL Editor).
  Say so in the PR. Never edit an already-applied migration; add a new one.
- `lib/catalog.json` + `npm run seed` is the catalogue's source of truth. Seeding is idempotent,
  so either person can run it after pulling.
- **This file is shared memory.** Both Claude Code sessions read it and nothing else carries
  over between them. When you learn something the other person's Claude needs — a decision,
  a gotcha, a changed invariant — put it here in the same commit as the work.
- Commit as yourself. No identity workarounds are needed now that the repo is public.

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
7. **The artwork pages are still centred on half pixels.** `styleFor` in
   `ArtworkPage.tsx` rounds the mark's own half-width but leaves `left: 50%`,
   and 50% of an odd stage width is a .5 — measured live on /about, the intro
   and focus bodies sit at x=308.5 and the three footer buttons at 345.5 /
   420.5 / 495.5, so every one of them is resampled row by row. This is the
   same softness the owner reported on the cigarette pages. The cigarette page
   fixes it with `left: round(50%, 1px)` (Chrome, Safari 15.4+, Firefox 118+,
   with the plain 50% left above as the fallback), which cannot be written as
   an inline style because React allows one value per property — so the fix
   here needs the parts to carry a data attribute and let the stylesheet own
   `left`. Small, but it touches the shared layout engine, so it is its own
   change rather than a rider on someone else's.

## Gotchas learned the hard way
- Run `next build` only with the dev server stopped; both write to `.next`. If you need
  the pre-commit build while someone's dev server is up, `NEXT_DIST_DIR=.next-build npm run
  build` sends it elsewhere — but Next rewrites `tsconfig.json` and `next-env.d.ts` to point
  at that directory, so `git checkout --` both afterwards.
- Restarting the dev server invalidates Server Action ids in open tabs → `POST 404`; hard-refresh.
- Vercel Hobby blocked deploys authored by a non-owner while the repo was private; the repo was
  made public to remove that constraint. If it is ever made private again, that returns.
- `far-east.vercel.app` is NOT this project (someone else's site). Production is `far-east-beta.vercel.app`.
- If the live domain serves `/logos/*.svg` (200) but `/` and `/_next/static/*` are 404, the
  Vercel project's Framework Preset is not "Next.js" — it is serving `public/` as a static site.
- Verifying signed-in UI: `.verify/temp-user.mjs` creates a throwaway auth user directly in
  Postgres (then `delete`). Never use real credentials for tests; the tools refuse piped input.
