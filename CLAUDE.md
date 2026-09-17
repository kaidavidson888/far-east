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
- `npm run build:sigil` — cuts the cloud ornament down for the age gate and
  for the site's pointer. Re-run it if `public/landing/parts/cloud.svg` changes;
  it prints the cursor hotspot line to paste into `globals.css`.
- `npm run build:cigs` — rebuilds the 282 pack marks in `public/cigs` and `lib/cigs.json`
  from the owner's `Cigs Images` folder (path at the top of `scripts/build-cigs.mjs`).
  `CIGS_ONLY=<substring> node scripts/build-cigs.mjs` rebuilds just the matching
  sources and prints what the reasoning decided for each — the crop candidates,
  what squaring off and peeling did, and the region that ends up being drawn.
  It leaves the manifest and the rest of the folder alone, so it is for looking,
  not for shipping: **re-run the full build before committing a crop change.**
- `npm run audit:cigs` — checks every pack crop against its source photograph
  and names the ones that cut into the pack (needs the `crops.json` that
  `build:cigs` writes). Run it after any crop change; see "The cigarettes".
- `npm run build:font` — sets the owner's numerals, # and $ into their webfont
  (`scripts/assets/far-east-webfont.woff2` + `numerals.svg` + `hash-dollar.svg`
  → `public/fonts/far-east-N.woff2`). Splices the glyphs in at the table level
  and checks every letter comes back byte-identical. After it: bump N in
  `globals.css` and `app/layout.tsx`, re-measure `far-east-ink.json` in Chrome,
  `build:shelf`, and `build:cigpages` (the phone pages embed the face). See
  "The owner's own face".
- `npm run audit:cigtext` — estimates every line of type on the built cigarette
  pages against the box it sits in and lists the tight ones, worst first, with
  the width it had in the original digits beside it. Run it after a font change.
- `npm run build:menu` / `npm run build:growmenu` — bake the two logo menus out of
  their GIFs (`monkey-bar.gif` for the cigarette pages, `monkey-grow.gif` for the
  landing page) into `public/menu` + `lib/menu-geometry.json` and `public/growmenu` +
  `lib/growmenu-geometry.json`. The grow bake takes a couple of minutes and MEASURES
  everything it can — the scale off the first frame, the six words off the last — and
  stops rather than guessing. See "The logo menu" below.
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
- **The logo menu** (`components/LogoMenu.tsx`) is on the landing routes and the
  cigarette pages — its ground is white, so it cannot go on the red inner pages. Hovering
  遠東 unfolds it; pressing mid-run skips to the end; pressing the logo again or anything
  else runs it back at 2x. Frames are baked from a GIF because a GIF cannot be seeked,
  paused or reversed. The canvas draws over the page's own logo rather than replacing it —
  frame 0 IS that logo, and the bake measures the alignment rather than assuming it.
- **THERE ARE TWO MENUS AND ONE COMPONENT.** They are the same machine — same scrub, same
  phases, same rules about pressing — and differ only in what was drawn and what the words
  do, so each is described entirely by its geometry JSON and neither has its own copy of
  `LogoMenu`. `menu="bar"` (the default) or `menu="grow"` picks one.
  - **bar** — `npm run build:menu`, `scripts/assets/monkey-bar.gif`, `lib/menu-geometry.json`,
    `public/menu/`. A red box round the logo and three labelled boxes unfolding right, plus
    a fourth the bake synthesises for home. **The CIGARETTE PAGES use it** and need that
    fourth box, because there the logo is the menu's switch rather than a link. Its logo ink
    lands at 46,28.
  - **grow** — `npm run build:growmenu`, `scripts/assets/monkey-grow.gif`,
    `lib/growmenu-geometry.json`, `public/growmenu/`. The owner's 2026-09-16 drawing: a box
    round the logo, then branches growing out of it carrying six words — about us, privacy
    policy, terms of service across the top and MY SAVED, OFFERS, RECOMMENDED stacked under
    the logo — which recede again over the last thirty frames and leave the words standing.
    **The LANDING PAGE uses it, and the three labels that used to be printed on that page
    are now three of those six words** (see the landing section below).
- **The grow bake has to do three things the bar's did not**, and all three are measured
  rather than chosen — read the header of `scripts/build-grow-menu.mjs`:
  - **Scale.** The bar was drawn at the page's own size; this is drawn at **4.15x** it
    (1840x1136 against a 390-wide page). The scale is the gif's first frame — which is the
    logo and nothing else — over the logo part's own box, and **the two axes have to agree
    or the source is not what we think it is**: 40/166 and 87/361 are both 0.2410, and the
    build stops if they ever differ by more than a per cent.
  - **Alignment.** Each frame is resized and then **extracted at a whole device pixel**
    chosen to put the gif's logo ink on the page's logo box; the residual is printed and
    asserted under a quarter pixel. It comes to 0.148 x 0.075 CSS px, and the canvas's
    frame-0 ink measures 45,28 on the page's own 45,28 — where the bar's rule was half a
    pixel.
  - **The six words are found, not typed in.** The final frame's ink is grouped into blobs
    (dilated by 4.5 PAGE px, which reaches across the line break inside "privacy policy" and
    not across the gap to "terms of service"), the blob holding the logo is set aside, and
    the rest are sorted into reading order. **Not exactly six and the build stops** rather
    than shipping a menu with a word nobody can press. Only what each word DOES is a table
    (`ITEMS`), because that is the one thing pixels cannot say.
- **How a word answers the pointer is the geometry's `hover`.** `invert` is the bar's: the
  box fills and the label reverses out, which cannot be painted over the frame (the label
  would go with it), so the bake writes a second image per box. `dim` is the grow menu's:
  its words have no box to fill, so the word's own rect is CLEARED and the frame drawn back
  into it at 50% under the pointer and 25% held — which is exactly what OFFERS, My Saved and
  RECOMMENDED did as page parts. Clearing first is what makes it a dim; drawing at half
  alpha over the word already there would only darken it. Nothing is baked, so the two
  states cannot drift apart. Verified in the page: 154.8 mean alpha at rest, 82.8 hovered,
  45.8 held, back to 154.8 exactly on leave.
- **A word that is not a link is a button carrying `data-part`.** My Saved's is `saved` —
  the same attribute it had as a page part, so `CigScroller`'s capture-phase listener spins
  the row with no change at all. OFFERS and RECOMMENDED are `inert`: drawn, hoverable and
  going nowhere, as they were on the page. **Not `disabled`** — a disabled control takes no
  pointer events in Chrome, so it would stop answering the pointer as well.
- **The grow menu weighs 3.5MB** (197 frames, 744x468, lossless WebP), against the bar's
  953KB. It loads on `requestIdleCallback`, after the page's own artwork. That is what the
  frames genuinely cost: every ink pixel in it is pure black, and storing the alpha channel
  alone comes to the same bytes, so WebP is already exploiting it — **and lossy WebP is not
  an option, because sharp silently keeps lossless for an image with an alpha channel** (q10
  and lossless came back byte-identical). The lever, if it is ever needed, is `SS` in the
  bake: 1 instead of 2 quarters the pixels and costs sharpness on a dense screen.
- **The frames carry no white.** The gif paints its background white and 90% of a finished
  frame was opaque white, which cut across whatever the canvas sat on — on the cigarette pages,
  the red rule round the info. The bake un-multiplies every frame out of white on the way out:
  ink over white is `p = C*a + 255*(1-a)`, so `a = 1 - min(r,g,b)/255` and
  `C = (p - 255*(1-a))/a` recovers the colour and the coverage exactly, for any ink colour.
  **Not a colour key** — those leave a light halo on every antialiased edge, and this leaves
  none, because it is the arithmetic the gif's own renderer did, run backwards. Everything
  upstream of the write still works in RGB over white, which is what the fourth box's synthesis
  and the pressed states want; the pressed overlays stay opaque, because they are meant to fill
  their box.
- **So the page's own logo steps aside while the menu is out** (`[data-part='logo']` on the
  artwork pages, `.cigpage-logo` on the cigarette pages). The white ground used to hide it by
  covering it; without that, two identical marks would sit on top of one another and the
  strokes would thicken the moment the menu opened.
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

**One change is made to the design as supplied: the title block moves.** Brand,
variant and full name go up under the 遠東 logo and take the landing page's own
left edge for it — three pixels in from the logo, the same as OFFERS — keeping
their spacing relative to one another. Everything else stays where it was
drawn, and the same page serves a phone and a desktop.
`scripts/lib/cigpage-layout.mjs` does the move, and two things in it are worth
knowing before touching it:
- **It moves a band, not three elements.** Each vector is a flat list of rects,
  images and texts with absolute coordinates and no ids, but all 227 lay the
  page out in the same six horizontal bands, which never interleave (surveyed:
  two shapes, differing by one rect in the ratings band). So the title's run of
  elements is wrapped in a `<g translate>` and nothing inside is retyped.
- **The frame is fixed, not measured.** A crop that followed the ink would move
  when the title moved, which would move the title: the alignment would chase
  itself. The frame is the design's own (x=39, w=304), which at 390 puts the
  body at stage x=43 and so the title's vector x=44 on stage x=48 — the logo's
  45 plus the OFFERS 3. **That alignment is exact at the design's own width**;
  the body is centred, so on a much wider window it drifts right of the logo.
  Anchoring the body left would hold it at any width, at the cost of the equal
  side margins — the owner's call, not one to make unasked.
- **Every pack on the row is a button, but there are not 247 vectors.** The
  owner supplied one info-page vector per cigarette *name*, and twelve packs
  carry a name another pack already has (`299_Karelia-Blue` and
  `252_Karelia-Blue`, `111_GoldenLeaf-Love_Style` and
  `42_Golden_Leaf-Love_Style`, ten more). The build gives the vector to
  whichever asks first; `lib/cigPages.ts` sends the other twelve to their
  twin's page, matching on the name with punctuation and spacing removed —
  which is what makes `GoldenLeaf` and `Golden Leaf` meet. Use `PRESSABLE` and
  `pageFor()` from there rather than `cigpages.json` directly, or those twelve
  go dead again. If the owner ever settles those names into genuinely
  different products, each will claim its own vector and this finds nothing
  to do.
- **The 5px red rule round the info** is `INFO_BOX` in the same file, drawn by
  the page rather than baked into the vector. It frames the title block down to
  the foot of the comment panels and deliberately leaves the logo and the seal
  outside it — they are the page's furniture, not the cigarette's. That box is
  only constant across all 235 pages because the build puts the title on the
  landing page's own line, so its ink top is 161 whatever the brand name.
  **It stands off the info by that page's own brand-to-flavour gap**, which is
  not a constant — every line on these pages is sized to its own phrase, so the
  gap runs 14 to 28px (median 19). `titleGap()` measures it on the file that
  actually ships and the build records it as `pages[].gap`.
  **CSS clamps the stand-off to the room there is** (`.cigpage-frame`): the rule
  is the widest thing on the page, and on a 360px phone the widest gaps would
  push it off the edge. The clamp only bites below about 370px.
  The red is the artwork's own `#FF0000`. **Not `--negative`** — that token is
  warm grey and is never an error colour, per the spec.
- **The bookmark is the one control inside the artwork.** The owner asked for
  it to be a button: black at rest, red under the pointer, red for good once
  it is pressed, and pressing it puts that cigarette on your shelf. A page
  loaded through `<img>` is out of CSS's reach, so the mark comes out of the
  vector the way the logo and the seal already do — `stripBookmark` in the
  build — and `components/CigBookmark.tsx` draws the same path back at the
  same coordinates, where a stylesheet can colour it. `BOOKMARK` in
  `lib/cigPages.ts` carries the geometry, taken off the vector and rounded
  outward so nothing lands on a half pixel. **The box round it stays in the
  artwork**: that is the outline of the control and it never changes.
  **The box is the button, the mark is what reddens** — the design draws it as
  a control, the plus beside it is plainly one too, and it gives a 72x66
  target rather than a 34px one.
  It is **add-only, not a toggle**, which is what "red permanently" means: once
  saved it stops being a button at all and becomes a `<span>` carrying the
  state, rather than a dead control that still invites a press. Taking
  something back off is the shelf's job, and **the shelf page does not show
  packs yet** — see Known gaps.
- **The pack shelf is a different table from the catalogue shelf.**
  `favorites.cigarette_id` is a foreign key into `cigarettes`, which holds 32
  placeholder products from `lib/catalog.json`; these 235 pages are the owner's
  own vectors, keyed by the pack's source filename. Putting one in `favorites`
  would mean inventing a brand, a country, a tar figure and a verdict for each.
  So `public.pack_favorites` keys on `pack_id` — text, deliberately not a
  foreign key, because the pack list lives in `lib/cigs.json` and is rebuilt
  from the owner's image folder rather than seeded. **What is saved is the
  PAGE's id, not the pressed pack's**, so the twelve name-twins save as the one
  cigarette they are. Migration `0003_pack_favorites.sql`, **already applied to
  the shared Supabase project** — do not apply it again.
- **The menu canvas is cut to 360px on the cigarette pages**, which is exactly
  a 360px phone. The bar with the home box reaches x=354, and `SLACK` in
  `build-menu-frames.mjs` is 6 rather than 10 for that reason: at 10 the canvas
  was 364 and scrolled those pages sideways by four pixels. It is transparent
  at rest but its box still counts.
- `scripts/assets/far-east-ink.json` is the per-character ink extent of the
  owner's face, measured in Chrome. It is what lets the build know where a
  line of text actually starts and stops, which is what the title's ink top is
  measured from. Regenerate it the same way if the face ever changes — a
  canvas, `1000px "Far East"`, `measureText` on each of the 66 characters,
  `actualBoundingBoxAscent/Descent` and `width` rounded to whole units — and
  **check the characters that did not change come back with exactly the
  figures they had**; that is the test of the method, and it caught a
  transcription slip the last time (numerals, # and $, 2026-09-14: every
  letter matched; only those twelve moved). It is a whole-unit measurement of
  the RENDERED glyph, so a round glyph reads a little taller than its outline
  (E's outline stops at 694, Chrome says 703; the new 0 at 698 says 703).
- **The phone's page carries the site's face, swapped in by the build.** The
  owner's vectors embed their webfont as a data URI — the only way an `<img>`
  can set type in it — and the face the site serves has since been rebuilt
  with the owner's numerals, # and $ (`npm run build:font`). `swapFace` in
  `build-cigpages.mjs` replaces the embedded copy with `FACE`
  (`public/fonts/far-east-N.woff2`; bump it with the stylesheet). The desktop
  arrangement is inline markup and uses the page's own font, so it needs no
  swap — which is exactly why the swap is needed: without it a phone showed
  the old numerals in every price while a desktop showed the new. **A font
  change means `build:cigpages` again**, the half-hour one.

**Some of the supplied cut-outs are not tight, and the crop has to peel them.**
The alpha on the Lotus / Nanjing / Taishan / Huanghelou block (ids 222-242) runs
past the pack into a margin of the photograph's own white paper — opaque, so it
came along, up to a ninth of the pack's width down the right-hand side. Nothing
upstream removed it: when a source is a cut-out the subject IS the alpha, so the
crop is exactly as loose as the cut-out was, and `squareOff` only ever looks at
the top and bottom. `tighten()` peels near-white lines inward from each edge.

It is **not a colour key**, which is forbidden here for good reason — a pack's own
white panels would go with it. It only ever eats INWARD FROM AN EDGE and stops at
the first line that is not paper, and a pack's white panel is enclosed by the
pack, always behind at least one line of print, bevel or shadow. It is capped at
a fifth of a side and held to the same standard as squaring off: a peel that
leaves something no longer box-shaped has eaten the pack and is dropped whole.

**Where it declines to peel, that is the answer, not a failure.** On a pale pack —
Lotus Silver, Taishan Baisha, Nanjing Blue — the boundary between the pack's own
cream surface and the paper beside it is exactly the thing not to guess at, so
those keep their margin. The instruction has always been that the box wins over
the tidier crop. The build lists every peel, deepest first, so an outlier is
visible rather than silent.

**`npm run audit:cigs` checks every crop against its source, and it found six
clips the build's own report could not.** The owner saw packs in the row cut
short. The build lists what it PEELS, but the clips were not peels — they were
crop candidates stopping short on a WHITE FACE, which reads as empty to every
measure the build has: Hongtashan and Yunyan lost their bottom warning lines,
Ashima its whole brand panel at the top, Zhenlong its white top and emblem,
Rothmans and Yuxi (source file 219) a rule's width at an edge. All six are now
in `HAND_CROP`, measured off the source. The audit reads the crop boxes the
build records in `scripts/assets/cigs/crops.json` (kept out of `cigs.json`,
which the row loads in the browser) and asks two things of the pixels each crop
left out: how much of a removed strip is INK, and — for cut-outs — whether a
solid opaque strip above or below the crop is PAPER-WHITE or not. The second
is the one that matters: a white top that was cut and paper that was trimmed
are both white, and only the alpha plus the paper test tells them apart. Its
ink list is read, not obeyed — the loose cigarettes and overhanging splashes the
"just the boxes" pass removes on purpose show up there too. It also confirmed
the peels: of 136, one touched a top or bottom at all, and that one (Raison)
was transparent, not pack. Run it after any crop change.

**A crop change means rebuilding the pages too.** Each of the 235 info pages
carries a copy of that pack's cleaned mark (`fitPhoto` reads `public/cigs/<id>.svg`),
so `npm run build:cigpages` has to follow `npm run build:cigs` or the row and the
page will disagree about the same cigarette.

**Pressing a pack that is not in the frame fetches it, rather than opening it.**
One press brings it to the middle, a second goes to its page. The travel uses
the settle’s own exponential at half the time constant — the owner’s 200% — so
arriving reads as the row coming to rest, which is what it is doing.

It aims at an ABSOLUTE offset, not a distance: the settle recomputes from
wherever the row is on every tick and always targets whatever pack is nearest
the middle, so a moving target would have the two fighting over which pack is
being fetched. When the seek lands, the pack it fetched IS the nearest, so the
settle agrees and has nothing to do. Any wheel, drag or key cancels it — a hand
on the row outranks a seek it did not ask for.

The distance is the one ON SCREEN, taken from the slot pressed. That slot is a
particular instance of the pack on a particular lap, so centring it is always
the short way round; working from the pack’s index would have to pick a lap and
could send the row most of the way across the set to reach something sitting
just off the edge of the frame.

The unpicked packs are buttons with `tabIndex={-1}` and `aria-hidden`, so a pointer
gets the semantics and the pressable cursor while the ROW stays the single
control for a keyboard and a screen reader. Fifteen more tab stops that each
only scroll the thing you are already standing on would be worse than none, and
the arrow keys already move the selection a pack at a time.

The cigarette row on the landing page is measured off two references the owner supplied, both
kept in `scripts/assets`: a positioning SVG and an MP4 of the motion. The MP4 runs at **8fps,
dead constant** — that stepping is deliberate and the owner likes it, so the row is driven by a
125ms timer rather than rAF. All of it is written up in `lib/cigRow.ts`.

**THE ROW IS DRAWN BIGGER THAN IT IS LAID OUT** (`cigZoom` in `lib/cigRow.ts`,
the owner's 2026-09-14 ask: "scale the scrolling catalogue up while
maintaining everything else the same … just big enough where only 7 packs at
max are visible on screen at a time"). A CSS `zoom` on `.cig-row`, as the
shelf's rows are zoomed — the layout, the physics and the paint all still
work in row px; the row is simply rendered larger, the same motion at the same
pace. The zoom is the screen's width over seven mean pitches of the catalogue
(lap ÷ pack count, ~88px): about 1.6 at 961 wide, 2.1 at 1280, never below 1
(a phone already shows fewer than seven), and capped so the band — centred on
the screen's height — stays clear of the label column above it
(`LANDING_ROW_CLEAR`). Pointer and wheel movement come in screen px and are
divided by the zoom, so a drag keeps the packs under the hand one for one; the
reset button reads the zoomed band height (`--cig-band`) so it keeps its 8px
under the row. `clientWidth` on the zoomed row is in row px already.

**MY SAVED SPINS THE ROW LIKE A ROULETTE WHEEL AND SWAPS THE PACKS MID-SPIN.**
Pressing it throws the row at `CIG_SPIN_SPEED` (10,290px/s, 54x the pace the
owner's recording runs at), and after exactly ONE LAP of the catalogue —
`CIG_SPIN_LAP`, 20,580px, derived from `cigLayout()` so it moves if the row
does — the packs are replaced by the reader's own shelf, the velocity is set
back to `CIG_FLING_MAX`, and **the rest is not animation code at all**: it is
the same `CIG_BRAKE` and the same settle that end every other throw. The
owner asked for the momentum to return to normal and the rest to play out as
it normally would, and the way to honour that is to hand back to the physics
rather than to script an ending.

- **The swap is hidden by the speed, not by a cut.** The row never stops and
  nothing fades. At spin speed the packs are a smear, so there is no frame in
  which a reader could see one set become another.
- **The shelf is fetched while the wheel is already turning.**
  `savedPacksAction` is called on the press and the spin starts in the same
  breath, so the round trip happens INSIDE the animation. If it is slow the row
  keeps spinning past one lap and swaps on the frame after it lands — it never
  swaps early and never stops to wait, because both would show the seam.
- **It is unskippable, which the owner asked for.** `lockRef` is set for the
  whole animation and every input checks it — wheel, drag, arrow keys, and
  pressing a pack. It comes off in exactly one place: where the tick decides
  the row has come to rest.
- **THE ROW'S CONTENTS ARE NO LONGER A MODULE CONSTANT.** `LEFT`/`LAP` used to
  be computed once at import; they are now `layoutRef`, recomputed when the
  packs change, because a shelf is a different number of packs of different
  widths. Anything reading `CIG_PACKS` inside the component is a bug — read
  `packsRef.current` in the tick and `packs` in the render.
- **The handover out of the spin has TWO smoothings, and both were needed.**
  The first version snapped: the owner called it jitteriness and they were
  right. (a) The velocity used to be ASSIGNED back to `CIG_FLING_MAX` in one
  frame — 10,290px/s to 379 between two paints, a 27-fold drop with nothing in
  between. It is now a **catch**: one constant `CIG_SPIN_CATCH` over 400ms,
  genuinely decelerating the whole way, ~2,100px of travel. The momentum still
  ends at the normal amount; it just gets there over 400ms instead of
  instantly. (b) The paint rate used to switch on a flag, so the row went from
  40fps to 8fps at the same instant. `cigPaintMs(speed)` makes it a function
  of SPEED, so the row is already back on 125ms by the time it is slow enough
  for 125ms to be right. **Below `CIG_FLING_MAX` it returns exactly
  `PAINT_MS`**, so the owner's 8fps is untouched for every motion the
  reference actually measured — drag, wheel, fling, settle. Only the spin ever
  goes faster.
- **The shelf's artwork is decoded BEFORE the swap** (`preload`). Handing React
  fifteen new `src`es mid-spin means fifteen fetches, and until they land the
  slots are empty — the row visibly thins out at the exact moment it is meant
  to be unreadable. It costs nothing because it happens while the wheel is
  already turning. This was the third cause of the jitter.
- **The spin is the one place the 8fps rule is set aside** (`CIG_SPIN_PAINT_MS`,
  25ms, the floor `cigPaintMs` clamps to). At 125ms a single frame covers
  1,286px — about fifteen packs — so consecutive frames share nothing and the
  row reads as static noise rather than as something turning. That is aliasing,
  not the owner's stepping.
- **`reset` puts the catalogue back, through the same spin.** A black button
  under the row's left end, white "reset" in the owner's face, inverting on
  hover. It calls the same `startSpin`, passing the whole catalogue instead of
  null — so the throw, the lap, the catch and the handover are one code path
  for both buttons, which is what the owner asked for. It is **12px off the
  viewport edge, NOT the page's 45px left margin**: it belongs to the row, and
  the row is full-bleed and ignores the margin rule by design. It carries a
  black border in both states so that inverting leaves a white box with an
  edge rather than white text on a white page. Disabled while a spin runs.
- **THE PAGE'S OWN LOGO NOW STAYS PUT WHILE THE MENU IS OUT**, lifted to
  `z-index: 4` instead of being hidden. It used to go to `opacity: 0` and let
  the canvas's copy show, and the owner could see the difference: the logo
  "changed opacity" the moment you hovered it. Both marks land in the same
  place — measured live, the vector occupies x 45..85 and the canvas's copy
  46..83 — but the canvas's is a RASTER, two pixels narrower, carrying the
  soft edges the un-multiply leaves (mean alpha 209 against a vector's hard
  255). Swapping a crisp mark for a soft one that size reads as it going
  lighter. The vector is lifted rather than the canvas clipped, because the
  canvas has ink outside the logo from frame 0 — a 3px red connector at
  x 31..33 — which clipping would take with it. **It must also carry
  `pointer-events: none`**: lifting it over the menu also lifted it over the
  menu's own button, and the menu stopped opening at all until that was added.
- **The button is reached by delegation.** `ArtworkPage` draws My Saved as a
  plain button with no destination and is rendered by a SERVER component, so a
  handler cannot be passed down. `CigScroller` listens on the document in
  capture phase for `[data-part="saved"]` instead — the same hook the
  stylesheet uses — rather than restructuring that boundary for one button.
- **An empty shelf is left alone**, so the spin plays out on the catalogue and
  the reader ends up where they started. It is not broken, but it does not say
  "you have not saved anything" either, and there is nowhere on this artwork to
  say it without inventing UI. **The owner's call.**
- **Getting back to the full catalogue is a reload.** Nothing was asked for, so
  nothing was invented.
- Verifying it needs a signed-in reader with a shelf: `node .verify/temp-user.mjs`
  then `node .verify/spin-fixture.mjs` gives the throwaway user a google
  identity (so the splash lets them straight in) and six packs spread across the
  row. `node .verify/temp-user.mjs delete` cascades it all away.
  **The motion cannot be timed in the Browser pane** — it throttles timers, so
  the spin takes about four times its real length there. Distance is right,
  wall-clock is not.

**THE PLUS BESIDE RESET OPENS A TAG FILTER FOR THE ROW** (the owner's
2026-09-14 ask). Four controls now sit under the row's left end, all of them
the reset button's 88x30 with 10 between — `CIG_CONTROLS` in `lib/cigRow.ts`
is the one copy of those numbers, handed to the stylesheet as custom
properties on `.cig-controls` so the component's arithmetic and the CSS
cannot drift.
- **The plus and minus are the owner's own marks** (`lib/cigToggleGlyph.ts`,
  supplied as `scripts/assets/tag-plus.svg` and `tag-minus.svg`): a pinwheel
  of four rounded bars about a centre dot, and a bar with an eye in it. They
  are **drawn inline and filled with `currentColor`**, never loaded as an
  `<img>` — the button inverts under the pointer, black ground and white
  mark, and an image cannot inherit that; the owner's files paint them warm
  brown on cream, and both of those go. Sized to sit inside the rule: the
  button is 30 square with a 2px rule, the plus takes 16 of the 26 that
  leaves (5 clear all round) and the minus takes THE SAME SCALE rather than
  the same width, so the pair keeps the proportions they were drawn with (18
  x 6.9, 4 clear at the sides). Each viewBox is that glyph's own ink box,
  measured off a render at 4x — the supplied frames are mostly empty around
  the mark. Before these arrived it was two plain bars, because the owner's
  face carries no `+` or `-` to set and a fallback face's would have been a
  different letterform beside the house one.
- **Six groups, 81 buttons**, outlined rather than filled, half strength
  until hovered or picked, each group starting its own line in the grid
  under its own heading (below).
  Three are the info page's closed vocabularies — menthol (Y/N), harshness
  (Lite/mid/hard), pack price ($15/$25/$30). One is the **brand**, the name
  before the em dash, all 63 of them. The last two are **families**: the
  page's tasting notes and its pairings are open vocabularies (112 and 207
  distinct values across the 235 pages), so the owner asked for five
  categories encompassing each, and `scripts/build-cigtags.mjs` classifies
  every value into one — **Sweet, Fruit, Fresh, Floral, Earthy** for notes
  and **Cannabis, Alcohol, Beverage, Dessert, Savoury** for pairings.
  (That third one took the owner two goes to name. It was **Soft**, which
  means a cold fizzy drink where most of these are a tea or a coffee; then
  **Alcohol Free**, which is what they are but reads as a qualifier on the
  Alcohol button beside it rather than as a thing of its own; now
  **Beverage**, which it can be called because the one member that was not
  a drink has left — see the broth below. **No hyphen anywhere in a label**
  — the face carries letters, digits, `#` and `$` and nothing else, so
  "Non-Alcoholic" would have drawn its hyphen in the fallback face.)
  Anything
  unmatched is a HARD ERROR rather than a silent "other", so a word added
  later cannot quietly stop being filterable. Menthol's two buttons are
  labelled **Menthol and Regular**, the catalogue's own flavour words
  (`FACET_ORDER` in `lib/seed.ts`) — Y and N mean nothing on a button, and
  no word here is one we invented.
- **Three judgements are written into those families rather than hidden.**
  Earthy also takes the blend's own character (strong, balanced, classic,
  the origins), because those describe the smoke rather than a flavour.
  **A broth is food, so it is Savoury** (the owner's ask): "Herbal Broth"
  sat with the drinks on the strength of being sipped, which is the one
  thing about it that is not the point — it is stock with herbs in it, and
  it belongs with the jerky and the braised pork. The rule is the bare word
  so any broth added later lands there too, and one pack moves (Huangshan
  Huizhou Merchant, whose other two pairings are a wine and a strain).
  And **Cannabis is settled before anything else is weighed**: strains are
  named after puddings, so "Mint Chocolate (Hybrid)" and "Mint Chocolate
  Chip (Hybrid)" both landed in Dessert when the rules were only sorted by
  length — the bracket is what says what a pairing IS. Note that **every
  pack has a strain**, so Cannabis on its own matches all 247 and narrows
  nothing; it is there to be combined.
- **A pack can be in more than one family** — it has three notes and three
  pairings — so those two groups are array-valued and a pack matches if ANY
  of its families is picked, which is the array form of the same
  `= ANY(values)` clause. Verified: brand ESSE gives exactly its 13 packs,
  Fruit exactly the 43 the data holds, and the two together exactly the 6
  in both.
- **Long labels are set smaller, in the same box.** "Great Hall of the
  People" is 24 characters where "reset" is five, and every button is the
  reset button's 88x30. The build measures each label's width per em off the
  owner's ink table and `fitLabel` picks a size: 15px wherever it fits on
  one line, otherwise two lines at whatever fits, capped at 12 so the pair
  still clears the box's 26px. Only the longest dozen brands reach a second
  line.
- **EVERY GROUP HAS A HEADING OVER IT** (the owner's 2026-09-15 ask): a red
  outline two buttons wide and one tall, standing between one group of tags
  and the next with the group's name in it, in the owner's face, in capitals
  and bold — **MENTHOL CONTENT, HARSHNESS, PRICE PER PACK, FLAVOR PROFILE,
  RECOMMENDED PAIRINGS, BRAND**, in that order, their words and their order.
  Six of them, each OPENING a group; there is none after the last, because a
  heading opens a group rather than closes one ("stop after the last one").
  The words live in `GROUP_HEADING` in `scripts/build-cigtags.mjs`, which
  measures each one off the ink table and asserts the set and the order
  against the groups the buttons actually run in, so a group added later
  cannot arrive unnamed. `CIG_TAG_MENU` in `lib/cigTags.ts` is the grid as it
  is laid out — headings and buttons in one flat list, so the arrival's
  stagger counts through both.
  - **Bold is a stroke** (0.03em on the outline, the shelf price's own trick
    and the age gate's): the face has one weight and these controls set
    `font-synthesis: none`, so `font-weight: bold` would ask for exactly what
    the browser has been told not to fake.
  - **All six are set at ONE size**, worked out from the longest of them
    ("RECOMMENDED PAIRINGS", 13.84em) so that it fits its box on one line —
    12.86px, its ink 1.98px inside the rule at each end, which is the 2px of
    air a button's label gets. Sizing each heading to its own width the way
    `fitLabel` sizes a button gives six different sizes down a column of
    headings; a button is one of eighty and is read against its neighbours in
    the line, a heading against the other headings.
  - **It takes a whole grid line (`1 / -1`) and is DRAWN two columns wide**,
    rather than spanning two tracks. A span of two in a grid with room for
    one column would invent a second, implicit one and push the menu past the
    right edge the owner set for it; taking the line and stating the width is
    the same picture at every column count.
- **The matching is the catalogue's own**, ported rather than called:
  `listCigarettes` builds `column = ANY(values)` per facet and ANDs them, and
  `matchingPacks` in `lib/cigTags.ts` is that rule in the browser. It could
  not be the same query — that one reads the `cigarettes` table, which holds
  the 32 placeholder products, and the row is the 247 photographed packs
  which are deliberately not in it (see `pack_favorites`). A pack with no
  tags fails every tag, as a NULL column fails `= ANY(...)`.
- **`npm run build:cigtags`** writes `lib/cigtags.json` from the BUILT pages
  in `public/cigpages` — text only, so it takes a second where
  `build:cigpages` takes half an hour. **Re-run it after `build:cigpages`.**
  It is keyed by PACK, resolving the twelve name-twins with the same rule
  `lib/cigPages.ts` uses, so the browser needs one lookup and never has to
  carry the page manifest. Anything unexpected in a page is a hard error.
- **The menu arrives on the compositor: opacity and translation only.** Each
  button fades and drifts the last few pixels back from the plus, nearest
  first (a stagger off its own `--i`), which reads as coming out of the plus
  with nothing scaled — a scaled layer is rasterised once and stretched, so
  every letterform would be soft for the length of it. Three passes were
  clip-path first, which is NOT a composited property: every frame of it was
  a main-thread repaint, and no amount of re-easing a curve fixes a frame
  that arrives late. Two opacities are in play and they must not fight, so
  the arrival is on a wrapper (`.cig-tag-slot`) and the button keeps its own
  half strength; 1 x 0.5 is what the owner asked for. **A shut menu has to
  refuse the pointer explicitly** — the clip used to stop it as a side
  effect and opacity does not, and an invisible button that still takes a
  click is a trap. Each field starts its own line
  (`[data-first]`), and `auto-fill` takes as many columns as there is room
  for: three lines at a laptop width. **How far right it may reach is the
  owner's rule** — the right edge of the pack left of the framed one, which
  is `pickX` less the row's own gap, times the zoom. **On a phone that leaves
  no room at all** (50px at 375, which does not hold an 88px button), so
  below about 700px the grid runs to the page's right margin instead:
  `cigTagsRight`. That fallback is a judgement, not the owner's instruction,
  the same call as the shelf's `ROW_SCALE_FLOOR`.
- **The menu's scrollbar is the page's own colours**: a black thumb and
  black arrows on a white track, the WHOLE BAR going RED together the moment
  the pointer is anywhere on it and staying red while the thumb is dragged —
  the owner's ask, and explicitly *not* a change of opacity, which is what
  Chrome does to a bar by default.
  **All of it reddening at once needs the component**, because the
  scrollbar's parts are siblings with no selector between them:
  `::-webkit-scrollbar-thumb:hover` reaches the thumb and can say nothing
  about the arrows. So `CigScroller` watches for the pointer in the gutter —
  Chrome does deliver `pointermove` there, with the scroller as the target
  and an `offsetX` past its `clientWidth`, which excludes the bar — and puts
  `data-bar` ON THE NODE rather than in state, since 81 buttons live under
  that element and every pointer move would otherwise reconcile the lot. The
  per-part `:hover` rules stay as the backstop, and cover the drag, where
  the scrollbar has the pointer and the page is sent nothing at all.
  It is written with `::-webkit-scrollbar`, not `scrollbar-color`: the
  standard property cannot say "under the pointer" (there is no selector for
  the bar), and **where both are given Chrome takes the standard one and
  ignores the pseudo-elements**, so `scrollbar-color` is kept for Firefox
  alone, inside `@supports not selector(::-webkit-scrollbar)`. **The bar's
  width is stated (15px) and it is the width Chrome already drew**, because
  that width is what `scrollbar-gutter: stable` reserves beside the grid —
  change it and the grid gains or loses a column of tags. The arrows are
  drawn back in as SVG triangles, since a custom bar has none unless asked,
  and the two crossed button states are hidden or Chrome lays the bar out
  with an up AND a down at both ends.
- **That reach is MEASURED ONCE, WHEN THE PLUS IS PRESSED, and then held.**
  The pack left of the framed one changes every time the row moves, so read
  live the grid re-flowed under the reader's hand as the catalogue scrolled
  and the column count jumped about with it; the owner asked for it to stay
  as it first appears. The press sets it — so the opening frame is already
  the width it keeps — and a resize is the only thing that refreshes it, a
  stale width there being able to put the grid off the side of the screen.
  Reopening takes a fresh measurement, which is what makes it right for
  whatever pack is framed by then.
- **Confirm spins the row down to the matches** through `startSpin`, the same
  throw, lap, catch and handover My Saved and reset use — three buttons, one
  code path. **Reset drops every tag and leaves the menu open**, which the
  owner asked for: it undoes the filtering, not the reaching for it. A filter
  matching nothing leaves the row alone, as an empty shelf does (`swapTo`
  returns early). Verified end to end: Menthol + mid put exactly the 29 packs
  the manifest says, and only those, on the row.

**OFFERS, My Saved and RECOMMENDED ARE NO LONGER ON THE PAGE — they moved into
the logo menu** (the owner's 2026-09-16 ask, with the new drawing). The landing
page at rest is now the logo, the seal and the sigil pair, and everything you
can press beyond the row is reached by hovering 遠東. Three notes on what that
took:
- **The parts are still cut and their geometry is still read.** Only the three
  `anchored(...)` lines came out of `LANDING_SPEC.parts`, exactly as TEST YOUR
  LUCK did — so putting the column back on the page is three lines.
- **`LANDING_ROW_CLEAR` deliberately did not move.** It is still the old
  column's foot plus the design's gap, because the row's size was its own ask
  ("only 7 packs at max") and this constant is what decides it on any window
  short enough for height to bind. The menu's lowest word reaches 5px past that
  line; where a window is short enough for the two to meet, they meet only
  while the menu is open, and the menu draws over the row.
- **Their pointer treatment went with them**, and the block in `globals.css`
  under "the three landing labels" is a tombstone pointing here. They dropped to
  50% on hover and 25% held, with a 5px dash one space after the word (each gap
  measured off that label's own space, 0.32em, since the three were drawn at
  51.5, 18.9 and 18.1px). **The menu dims to the same 50 and 25** — that is
  where those two numbers went — but **the dash did not come with them**: it
  belonged to a label standing on the page, not to a word in a menu. Git has
  the block if the column ever goes back.

**The landing page has since moved off the design in four places, all the
owner's asks, all in `lib/landing.ts` and none in the artwork
build:** TEST YOUR LUCK is no longer placed (the part is still cut, so it is
one line to restore); **OFFERS, My Saved and RECOMMENDED are no longer placed
either (2026-09-16), having moved into the logo menu — above**; the sigil and the square sit under the seal, scaled as
one to the seal's 87px width, 13px below it (the design's gap from My Saved
to RECOMMENDED) with 5px between them as drawn, which the scale takes to 4;
and the three labels are a column whose top is the inside of that square's
top edge — its top plus its 3px stroke at the pair's scale (2.5), less the
1px the O's crown rises above the flat tops in the OFFERS drawing, rounded
to the whole pixel the box must start on: 2 below the outer edge, so the
letters' flat tops and the stroke's inner edge share a pixel row — OFFERS
shown at 14/37 of its drawn size — My Saved's 18.9px to the whole pixel, at
its own aspect so it is never stretched — with the design's 13px between one
line and the next. OFFERS's dash figures in the stylesheet are scaled by the
same 14/37.

## The owner's own face (`public/fonts/far-east-1.woff2`)
Supplied by the owner as `Far_East_Full_Webfont.woff2`, declared as the family
**"Far East"**, self-hosted, and reached through the `--font-typed` token.

**The rule the owner set: everything typed into this site is set in this face, in
every text field on every page, and so is any copy we write from here on** —
unless they say otherwise for a particular piece. `--font-typed` is how you ask
for it; do not name the family directly.

What is actually in the file, read out of it rather than assumed:
- **66 glyphs. Space, # and $, 0-9, A-Z, a-z, and nothing else.** No full stop,
  comma, apostrophe, hyphen, colon, @, parentheses, quotes, slash — and no CJK.
  Everything outside that set is drawn by the next family in the stack, which
  is why the `@font-face` declares `unicode-range` exactly: the browser then
  never consults this face for a character it does not have. **If you write
  copy that leans on punctuation, look at it rendered before you ship it.**
- **THE NUMERALS, THE # AND THE $ ARE THE OWNER'S LATER DRAWINGS, SET INTO THE
  FILE BY `npm run build:font`** (`scripts/build-font.mjs`). The owner supplied
  the face with its original digits, then drew a new 0-9 to match the letters
  (`scripts/assets/numerals.svg`: 688 tall like the old ones, 60 left / 83
  right bearings like the old ones, so the sizing on the site did not change —
  the ask) and a # and $ in the same hand (`hash-dollar.svg`), which the face
  never had; the site drew those two from the fallback until now. The build
  keeps the owner's file (`scripts/assets/far-east-webfont.woff2`) as the
  source, replaces the ten digits, appends the two marks, and copies every
  letter's outline and metrics through byte for byte — spliced at the table
  level (glyf/loca/hmtx rebuilt from the original records plus the new; head,
  hhea, maxp brought up to date; cmap and post taught the two codepoints;
  OS/2 and name untouched) rather than round-tripped through a font library,
  which would have re-serialised the letters too. It checks itself with an
  independent parser: every letter must come back identical. The sheets'
  cubics become TrueType quadratics within a fifth of a unit. Two things to
  know: `numerals.svg` is in glyph coordinates (y up) and states its advances;
  `hash-dollar.svg` is SVG coordinates (y DOWN) and states none, so it gets the
  numerals' rule (ink + 60 + 83). The new digits are wider than the old (the
  0 is 620 across against 515), so any run of figures grows; the shelf
  measures its price live and follows.
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
quality 11 and dropping the `post` table's glyph names together saved 50 bytes
of the original 6484 — 0.8%, for a rewritten font binary. Not worth it; it is
subsetted to exactly its cmap (66 glyphs, 66 codepoints, no orphans; 7312
bytes with the new numerals, which carry more points than the old). The wins
that were left were all in delivery, and they are done: preloaded in
`app/layout.tsx` (with `crossOrigin`, which is **not** optional on a font
preload even same-origin — without it the browser fetches the file twice),
`font-display: swap`, the exact `unicode-range`, and `/fonts/:file*` served
`immutable` for a year from `next.config.mjs`. **The version is in the
filename** — it is `far-east-3` now (`-2` was the numerals; `-3` the same with
the 4's dot drawn smaller, since at the price's size its bold stroke closed it
onto the counter — `DOT` in `build-font.mjs`); bump it to `-4` when the file
is next replaced, in `globals.css`, `app/layout.tsx` AND `FACE` in
`scripts/build-cigpages.mjs` together, or caches will hold the old one and
the phone pages will embed it. `npm run audit:cigtext` then says whether every
line of type on the cigarette pages still fits its box (with the numerals it
does; the tightest are the `$240/c` prices, 1.5px inside their rule).

## The splash is the sign-in screen
A signed-out reader who reaches for something needing an account — the bookmark
on a cigarette's page, the shelf button in the catalogue — is sent to `/`, not
to `/login`. `signInGate()` in `lib/siteUrl.ts` builds that address;
`/?next=<where they were>` carries them back afterwards, and `safeNext()` checks it
at both ends because it travels through a query string and an OAuth handshake.
Somebody already signed in who lands on `/?next=…` goes straight through.
`/login` still exists, still works, and is still what the header links to.

**EMAIL AND PASSWORD, WITH GOOGLE USED ONCE.** Both rows are typed into, as the
box is drawn. `splashAuthAction` decides in this order:

1. The address must look like one and the password must be long enough
   (`MIN_PASSWORD`, 8). Either failing flashes THAT row red and empties it,
   leaving the other row's text alone — the flash the owner drew, reused.
2. Try the pair. If it signs in **and the account has been through Google**,
   they are in and go where they were headed. **Google is not shown.** This is
   the path nearly every sign-in takes.
3. Sign-in failed but the address already has an account → the password is the
   wrong half. Flash the PASSWORD row, empty it, leave the address.
4. Sign-in failed and the address has no account → make one with that password,
   then hand them to Google to verify it. **The only time Google appears.**

An account with a password that never finished at Google is **not finished**:
step 2 sends it back to Google rather than letting it in, so closing the tab on
Google's screen cannot be used to skip verification. `accountState()` in
`lib/db.ts` is what knows — it reads `auth.identities` for a google row.

**THE PASSWORD GOES TO SUPABASE AUTH AND NOWHERE ELSE.** `signUp` bcrypts it into
`auth.users.encrypted_password`. It is **not** written to `profiles` — a password in
an application table is a defect however it is stored, and `profiles` is read
and joined all over this app. It is not put in a cookie, not carried through the
Google round trip, and never logged: `logAuthEvent` takes an address and an event
and nothing else, which is the rule for this site.

**The callback checks who came back.** Google shows an account chooser, so
somebody who typed one address and then picked a different Google account would
otherwise be signed into that one — leaving the address they typed as an account
with a password and nobody attached. `expect=` rides on the callback URL and a
mismatch signs them straight back out.

There is **no Google button** on the splash: the control is the one the owner
already drew.

**This tells an existing address from a new one, which is account enumeration.**
Type an address and the box behaves differently depending on whether somebody
has an account here. That is inherent in what was asked for — the two cases have
to look different — and it is worth knowing it is the trade. Supabase rate-limits
its own auth calls; `accountState()` is ours and is not rate-limited.

**THE HOLD IS THE DOOR ON EVERY DEVICE — four seconds on the seal, the whole
animation, to reach the login box.** The splash used to skip straight to the
form on a press when the device asked for `prefers-reduced-motion`, which most
phones do; that path never showed while a phone's long-press was still being
taken by the browser (see the gotcha at the foot of this file), and the moment
that was fixed a tap on a phone went through in one frame. The owner's rule
is the hold, so reduced motion no longer skips it; only the dev-only
`?splashform` flag does. A press before the frames have loaded is remembered
and starts the run when they arrive — but only if the finger is still down.

**The top row is the EMAIL row again.** It was EMAIL, the owner supplied PHONE #
artwork to replace it (a6c4c0c), and it takes an email once more — so the baked
EMAIL word in `blackbox.webp` is drawn again as an ordinary sprite window, and
`parts.email.cloudDx` is back to 0 because the ☁ no longer has to clear a wider
word. **Nothing was thrown away**: `phone-label.webp`, `SPLASH_GEOM.phoneLabel` and
the `phoneLabel()` renderer are all still there. To go back, draw `phoneLabel()`
for the top row's label instead of the window and set `cloudDx` to 0.1653.

**The PASSWORD row is still drawn and no longer typed into.** It is baked into
the frames, so it cannot come out without re-baking, and it is part of the
picture. It keeps every opacity rule it had; there is simply no input over it.

## Signing in with Google
**Google is not an alternative to Supabase Auth — it is a provider inside it.**
The handshake produces the same `auth.users` row, the same session cookie and the
same `currentUser()`; nothing downstream knows the difference. Replacing Supabase
Auth outright would mean rewriting every `references profiles(id)`, the signup
trigger and the RLS default-deny, for no gain.

Three things make it work, and only the first lives in this repo:
- `signInWithGoogleAction` (`app/actions.ts`) starts it. **A server action, not a
  link** — the flow is PKCE, so a code verifier has to be written to a cookie
  before the reader leaves, and cookies can only be written from an action or a
  route handler. An `<a href>` straight at Google would skip that and the
  callback would have nothing to exchange.
- `app/auth/callback/route.ts` catches them coming back and swaps the one-time
  code for a session. Any provider added later comes back through the same
  door. Node runtime — the only thing here that ever ran on the edge was the
  session middleware, and it crashed.
- `lib/siteUrl.ts` works out the origin to come back TO, from
  `x-forwarded-proto` + Host, because Vercel terminates TLS at the edge and the
  function itself sees http. `safeNext()` is there too: `next` rides through the
  handshake in a query string, so it comes back from outside — a
  protocol-relative `//evil.example` would be an open redirect handing over a
  freshly minted session.

**The credentials are not in this repo and must not be.** Client id and secret
live in the Supabase dashboard (Authentication → Providers → Google); the
redirect URI registered with Google is **Supabase's own**
`https://<ref>.supabase.co/auth/v1/callback`, never this site's. Both origins —
`http://localhost:3000/**` and the deployed one — have to be on the Redirect
URLs allow-list under Authentication → URL Configuration, or the last hop
lands nowhere. That list is enforced at the callback, so it cannot be checked
without completing a real sign-in.

**Migration 0004 is the part that cannot be fixed later.** `handle_new_user` read
`raw_user_meta_data ->> 'display_name'` — a field WE invent and pass in the
sign-up metadata. Google does not send it; it sends `full_name` and `name`. Every
reader arriving through Google would have been named after the local part of
their email, on every review they ever wrote, and the trigger fires once at
insert. The chain is now display_name, full_name, name, email local part,
phone, 'Reader' — our own field first, so nothing that works today changes.
The last two also mean a sign-up with no email cannot fail the NOT NULL insert
any more, which is what `splashAuthAction` has been working around.
**Already applied to the shared Supabase project**, along with 0003.

The button is `components/GoogleButton.tsx`, on `/login` and `/register`. Google's
four-colour G is **the one mark on this site drawn outside the palette** — their
branding terms require it; a monochrome or cinnabar G is not allowed. The rest
of the button is the house style. **The splash has no Google button yet**: `/` is
baked artwork, frame 100's login box IS the UI, so putting one there is a
drawing job and the owner's call.

## The cloud, as ornament and as pointer
Three of the cloud mark sit after the age gate's question, and the same mark is
the cursor for the whole site. Both come from `npm run build:sigil`, out of the
landing page's own `cloud.svg`.

**It is rasterised, and that is the point.** `cloud.svg` is 396KB — about 28,000
traced points at two decimal places on a mark 54 units wide, which is precision
to a hundredth of a pixel. Rounding the numbers only reaches 333KB; the weight
is the point count. `AgeGate` renders from `app/layout.tsx`, so it is on EVERY
page, most of which load none of the landing artwork — pointing an `<img>` at the
part would have put 396KB on the first view of `/catalog`, `/about` and `/login`.
The build writes a 2.7KB WebP at 3x its drawn size instead, the same oversample
rule the rest of the embedded art follows.

**The white ground comes off by un-multiplying**, exactly as `build-menu-frames`
does. The part is drawn for white paper — a white rectangle behind the cloud and
white inside the spirals — and on the gate's red panel that showed as a white
box. Un-multiplying recovers the ink and its coverage exactly, where a colour key
would leave a halo on every curve, and this mark is nothing but curves. The
spirals end up transparent, which is right: they are paper showing through, and
there the paper is red.

**The cursor carries a white keyline.** The ink is black and this site has black
to put a pointer on — the gate's NO button, the comment panel on every cigarette
page, the top nav — where a black cloud would not be there at all. The keyline is
a union of eight translations of the same silhouette in white, not a blur, so it
keeps hard edges; a blur reads as a shadow at cursor size. On white it is
invisible, which is what it is for. Checked against all four grounds.

**The hotspot is 0 14 and it is measured, not chosen.** The tail is the only part
of the shape that comes to a point and it sits about three quarters of the way
down the left edge. The build measures it off the finished pixels and prints the
CSS line; take it from there if the mark is recut.

**Pressable things invert it** — white cloud, black keyline, the same silhouette
to the pixel and the same hotspot, so the swap reads as a colour change rather
than as a different mark arriving. The build asserts the two hotspots match.

That is how the affordance survives losing the operating system's hand, and it
matters here more than on most sites: the artwork pages' hit areas are
transparent, the buttons ARE the artwork, so the pointer is the only thing
saying a thing can be pressed.

The rule is **the last one in `app/globals.css`, on purpose** — most of those
selectors already say `cursor: pointer` further up at the same specificity, so it
is source order that settles it, and anything wanting the hand back would have
to come after it. Its keyword fallback is `pointer` rather than `auto`: if the
image will not load, the hand is the right thing to land on, because the
element really is pressable.

`:disabled` is deliberately NOT in that rule. `.btn:disabled` keeps `not-allowed` at
a specificity it cannot reach, which is correct — a disabled control is exactly
the thing that is not pressable. `grab`/`grabbing` on the cigarette row and `text`
in the fields stay for the same reason: they say what the pointer can DO there,
which neither cloud can.

## The shelf, the plus, and Carton/Pack
The seal leads to `/shelf`: the reader's saved packs, drawn from the owner's
design (`scripts/assets/shelf-mobile.svg`). Three pieces, one rule between them
— nothing on this page is a picture.
- **The seal goes on the SECOND press.** `SealButton` runs its animation on the
  first press (skip-to-end if mid-run) and navigates only when it is already
  `open` — the owner's "after the animation is finished, click again". A button,
  not a link, so the first press cannot navigate.
- **The page is a template.** `npm run build:shelf` measures the design into
  `lib/shelf-geometry.json` (every mark rasterised alone and its ink box read,
  like split-svg-parts — Figma's rects carry quarter-pixel sizes and the type is
  outlined, so pixels are the only honest source). `lib/shelfPage.ts` turns a
  list of saved packs into a layout; `components/ShelfPage.tsx` draws it. Boxes
  are boxes, rules are rules, the clouds are `/sigil.webp`, the packs are the
  `/cigs/<id>.svg` marks the row uses, and **every word and number is re-set in
  the owner's face** — which is the ask and what makes it sharp. Type is sized by
  ink height: `size = inkHeight / (ascent/1000)`, ascents from
  `far-east-ink.json`, and placed by baseline (0.825 of the size in a
  line-height:1 box, measured in Chrome). **A numeral counts as its flat 688**
  (`DIGIT_HEIGHT` in `build-shelf.mjs`), not the overshoot the table reports
  for the round ones — the design draws numbers to the flat height, and the
  owner asked for the new numerals with their sizing kept; sized by the
  overshoot, `$240` would have dropped two per cent for the 0 in it. The
  geometry came out identical after the font change, which is the proof.
- **THE SHELF IS A GRID BETWEEN THE LOGO AND THE $ SIGN, TWO TO A LINE**
  (`shelfFit`). The owner's rule, in steps: each row's left edge on the right
  edge of the character logo and its right edge on the left edge of the
  "Click # When Finished" box (since taken off the page — the $ sign's left
  edge, which is where that box's edge was, is the line now), the rows keeping
  their arrangement — and then "scale them down again, same parameters, so
  that two fit in a row". So every
  pack's rule starts on its row's own left edge (`DX = -frame.x` puts the
  design's frame at row x=0; a wider pack grows right, into the gap before the
  boxes — a pack over ~69px wide at row scale would reach the boxes, an old
  latent edge), the boxes/panel/clouds keep the design's distance from it, two
  rows side by side make a line (`SHELF_COLUMNS`), the gap between them is the
  design's own pack-to-boxes gap (`COLUMN_GAP`, 15, read off the geometry, not
  chosen), and one zoom lands the second column's panel edge on the $ sign:
  `z = span / gridBodyWidth`. **Where a row lands is the stylesheet's**: each
  `.shelf-row` carries its index as `--i`, and `left`/`top` come from `mod()`
  and `round(down, …)` against `--cols`, `--col-pitch` and `--row-pitch`, which
  the stage sets — the column count is decided from the width on the client, so
  React does not place rows. Those functions have exactly the support of the
  `round()` the cigarette page already leans on; a one-column pair declared
  first is the fallback for anything older. The stage hands down `--rows-left`
  (the logo's DRAWN right edge — its rounded left plus width, so the grid never
  starts on a half pixel) and `--row-scale`; `.shelf-rows` divides both by the
  zoom, since `zoom` scales its own offsets. **The span depends on the zoom** —
  the logo is sized to the top pack, whose screen width is its row width × zoom
  — and the $ sign moves with the logo too, since the price's box is the
  logo's height (below) — so `shelfFit` iterates the fixed point: `z =
  (dollarLeft − C) / (G + tw/2)`, or with the logo's height clamp binding,
  `z = (dollarLeft − C − w/2) / G`, the box and the logo recomputed each
  round until the logo's width holds. Verified at 961 (the fixture's six
  packs, three lines): column one from the logo's right, column two's panel
  edge on the $ within a pixel.
  (Before this: one to a line between the same edges; before that, packs
  centred on the logo's axis at 80% of the fit to the right margin; before
  that, left on the margin. Each was the owner's instruction at the time.)
- **Every pack in a column sits on one axis, and the elements stand a standard
  margin off the widest** — the owner's rule. `shelfLayout` finds the widest
  pack's rule on the shelf (`widestPack`), centres every pack in a box that
  wide (a narrower pack floats with air either side), and moves the boxes,
  panel and clouds right by `dx` so the first box stands `PACK_GAP` (the
  design's own 15) past the widest pack's rule — exactly the design's
  relation, which drew a 58 frame with the boxes at 73. So a row's width is
  `rowWidthFor(widest)` = widest + 15 + `ELEMENTS_WIDTH` (253), which is the
  design's 326 for the design's frame and grows with a wide pack; `shelfFit`
  takes it as an input, and the stage sets `--col-pitch` from it. **The widest
  is taken over the whole shelf**, not per column, so both columns are one width
  and their boxes line up — the reading of "standardised"; per column would tie
  each column's width to which packs happened to land in it, and the column
  count is decided on the client. `shelfQuantityFrame(dx)` moves the plus's
  menu with the boxes.
- **The line is fitted to the $ sign, sigils excluded.** The owner's next ask:
  "scale them all up … so the right edge of each row not including the sigils
  is lined up with the $ sign". So the zoom is worked out against
  `gridBodyWidth` — a whole row, the gap, then a row's BODY (`bodyWidthFor`:
  widest + 15 + the boxes to the panel's edge, `BODY_RIGHT`, 233 in the design)
  — rather than the line's full width, and the clouds run on past the $ line
  into the margin, as excluding them implies. The $ sign's left edge is the
  price box's left plus its rule and its clearance (`dollarLeft` in
  `shelfFit`), and the price is placed INSIDE the box by its ink — the stage
  works the element's origin back from where the ink must sit, by the run's
  first bearing and the stroke's outer half — so the $ really does start on
  that line. (It used to be hung by its element, and an element is as wide
  as its run's advance, so the ink sat a bearing short of where the check
  said; the check reads ink now.) Verified at 961 and 1280: column two's
  panel edge on the $ to within a pixel, the clouds ending inside the right
  margin.
- **On a phone that rule has no room, and a fallback holds** — `ROW_SCALE_FLOOR`
  (0.6). The price's box is held to the room beside the logo, but at 375 its
  left is still around 150 and the logo's right at 85, a span of a few dozen
  px that would draw a pair at a twentieth of their size. The owner wrote the
  rule at a desktop. Below the floor the previous phone layout holds: ONE to a
  line, every pack's rule on the left margin, rows at `FALLBACK_SHRINK` (0.8)
  of the fit to the right margin. With two columns the switch lands at about
  735px wide, so phones fall back and tablets get the pair. **That is a
  judgement, not the owner's instruction**, kept in one place so it can be
  moved or removed; `data-fit` on the stage says which mode is live.
- **The logo is as wide as the top pack, about its own centre** — the owner's
  rule, "use its current centre of mass as a guide". It comes out of the same
  `shelfFit` solve as the rows (real width and height so the vector stays
  sharp) with its centre fixed at the landing page's (65, 71.5). **Its height
  is clamped** (`SHELF_LOGO.maxHeight`, 131): the top may not leave the page
  and the bottom may not pass the foot of the price's ink, the header's own
  baseline. On a desktop the zoomed pack is 100+px wide and a logo that wide is
  250 tall — off the page and through the divider — so there it holds at 60
  wide, and its right edge (95) is where the rows begin.
- **The whole page comes down until the logo's top margin is its left margin**
  — the owner's rule: the same distance from the page's top edge to the top
  of the mark as from the left edge to the mark's own left. **The mark's own
  left, not the page's 45**: the logo scales about its centre, so on a
  desktop (60 wide, the clamp binding) its left is at 35 and its top was at
  6, and it is the 35 that is matched; wherever the mark is as drawn both are
  45. Both edges come out of the fit, so the shift does (`shelfTopShift`),
  and it is not fixed: the stage hands it down as `--shelf-top`, every
  top-anchored thing — logo, header box, price, divider, the rows block
  (inside its zoom division) — adds it, and the stage's height grows by it.
  Nothing moves relative to anything else. Verified at 961 (top 35 = left
  35, shift 29) and 375: every other element down by exactly the shift.
- **On the shelf the logo is a link home, not the menu.** The logo menu's first
  frame IS the 40x87 logo, baked; it cannot sit on a rescaled mark without
  every frame being redrawn. `/landing`, per the logo-goes-home rule.
- **The quantity ("2c") is centred in its box** — equal margins to the rule above
  and below, the digit's ink (its ascent is the run's tallest) being what is
  centred. Placed relative to the inside of the rule. **A p is set smaller and
  lifted**: at the digit's size its descender ran 1.7px past the inside of the
  rule (the owner saw it clip), so it is set so that its whole ink — x-height
  to the foot of the descender — is the digit's ink height, and lifted by that
  descender, standing in the digit's own band with the same margins to the
  rule; the c has no descender and is left as it was (`qty.p` in
  `lib/shelfPage.ts`, from the `units` the shelf build writes into the
  geometry). Verified: "4p" and "9p" end a pixel inside the rule.
- **The price is bold and sits in its own box; the caption is gone.** The face
  has one weight, so bold is a stroke on the glyphs (`-webkit-text-stroke`,
  0.03 of the size, the age gate's trick). The owner's asks, in order: take
  off the "Click # When Finished" caption and its box; put a black outline
  round the price with the caption's own margins instead; scale the price and
  its outline up to the logo's top and side margins; then a 5px outline, the
  side margins equal to the top and bottom, and the right side on the right
  end of the red line. So (`PRICE_BOX` in `lib/shelfPage.ts`): a 5px rule —
  the divider's weight — with 11px clear on every side (what the caption had
  above and below its rule at the design width); the box's top on the logo's
  top, its right edge on `--aligned-right` where the divider ends, and its
  height the logo's, so the two share one band; the type as large as makes
  the run's INK, stroke included, fill that box less its clearances — the $
  rises above the digits and drops below them, and the whole run is what is
  held. On a narrow page the box is also held to the room between the logo's
  right edge plus the design's 15px gap and the margin; where that binds it
  is shorter than the band, its top still on the logo's. **The run is
  measured in the page** by `ShelfStage` on a canvas with the element's own
  computed font once the face is loaded — its ink width, rise, drop and first
  bearing, exact where the ink table is a whole-unit estimate whose width is
  the run's advance — and the origin of the element is worked back from where
  the ink has to sit, then the ink is centred in the whole-pixel box so the
  rounding's fraction splits between the sides. The table's figures are the
  first paint. Verified at 961, 1280 and 375: the box's right on the
  divider's right, its top on the logo's, its bottom on the logo's where the
  band binds, the ink 11 ± 0.5 off the rule all round.
- **The margins are symmetric, and everything meets the right one, at any
  width.** The owner's rule: the aligned right edge holds the same margin from
  the page's right as the logo holds from its left. The logo is left-anchored in
  real px, so the right must be too — `--aligned-right` is `width - MARGIN`,
  measured live by `components/ShelfStage.tsx`, not a fixed design x. The
  price's box hangs its right edge from that line — the red divider's right
  end — and the divider spans margin to margin. The rows do not reach the
  right margin: they end at the $ sign (see the rule above).
- **The rows are scaled with `zoom`, NOT `transform: scale`.** A transform
  scales finished pixels, and at 2x the type, the rules and the packs all went
  soft — the owner saw it. `zoom` lays the block out again at the new size, so
  type is set at the size it shows at, rules draw at their zoomed weight, and
  the packs come from their 3x rasters. `zoom` multiplies the block's OWN
  offsets too, so `.shelf-rows` has both its `top` and its `left`
  (`--rows-left`) divided by the zoom to land where they are meant to. The
  stage's height grows with the zoom. Chrome floors a zoomed border (3px at
  2.58 draws 7, not 7.74), so inset marks can sit <1px off.
- **Inside a ruled box, children sit inside the rule.** An absolutely placed
  child of a bordered box is positioned from the padding edge, so a mark
  measured from the box's OUTER corner needs the rule's width taken off its
  offset (`inside()` in `ShelfPage.tsx`) — or it lands 3px too far in, which is
  what the owner saw on the plus and the bookmark.
- **The reset's `img { max-width: 100% }` collapses an image whose absolute
  parent has no width.** The row is a set of absolutely placed marks with no
  width of its own, so the clouds went to 0 wide and vanished; `.shelf-cloud`
  and `.shelf-pack img` set `max-width: none`.
- **The document does not scroll under a fixed page.** The root layout's
  1000px footer sits in the flow beneath every artwork page, so the html grew
  its own scrollbar behind the page's — two bars stacked, 30px of dead space on
  the right of every desktop view, on the landing and cigarette pages too.
  `html:has(.artpage), html:has(.cigpage), html:has(.shelf)` → `overflow:
  hidden`; the fixed page scrolls itself.
- **The controls work.** The plus opens the same quantity wheels in the row's
  own box (`SHELF_QUANTITY_FRAME`: from the plus box's corner to the panel's
  far corner, three slots tall, `CigQuantity` takes a `frame`); the bookmark is
  a form on `removePackAction` — the cigarette page's bookmark only ever adds,
  so the shelf's is where a pack leaves, with its quantity.
- **The red divider between header and shelf is an addition**, not in the export
  (the only red there is the pack rules and the header caption). It is the
  site's red rule (5px `#FF0000`) from the left margin to `--aligned-right`.
- **The quantity shows as e.g. `2c`** in the third box — the amount then a
  lowercase c/p — set in the face like everything else. A bookmark-only pack has
  no quantity and the box is empty.

**The plus beside the bookmark opens a quantity menu** (`components/CigQuantity.tsx`,
`PLUS`/`QUANTITY_MENU`/`WHEEL` in `lib/cigPages.ts`). The plus box is the
artwork's (byte-identical in all 235 built pages, checked); only the hit area is
the page's. Hovering shows the menu at 50% (`pointer-events:none`), pressing
opens it solid at 100% over everything below — which cannot be pressed while it
is open. It grows out of the top-left corner of the outline, out and down
(`clip-path` animation — clipping, not scaling, so nothing smears), with a black
rule the plus box's own weight (3px) so it reads as that outline extending. Two
white stripes are wheels: 1-9 left, C or P right, both in the face, **full
height** so they touch the red top and bottom. **They loop**: a wheel's position
is a continuous, unbounded number and the values map by modulo — 9 is followed
by 1, C and P alternate — so the neighbours above and below the window are the
other options in view, and you can pull either way as far as you like. **One
captured gesture can do it all** — press the plus, slide onto a stripe and pull,
across to the other, lift — or open it and work the wheels by drag, wheel or
arrow keys. The value in the centred window is white from the start (it sits on
the red, cut through the stripe); touching a wheel is what counts as choosing,
and drops the OTHER values to 75%. Both chosen + pointer up → save and close;
press outside or Escape → close without saving. The drag reads the stripe's
real on-screen height so it tracks the finger under the shelf's zoom.
- **C = Carton, P = Pack**, stored on `pack_favorites.amount`/`unit` (migration
  0005; amount and unit are nullable TOGETHER, so a bookmark-only row is valid).
  `setPackQuantity` saves the pack too if it was not already saved. `amount` is
  held to 1-9 and `unit` to C/P in the DB, not just the UI — a server action is
  a public endpoint. `setPackQuantityAction` takes plain args, not a form: the
  menu commits on release with nothing to submit.

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
7. **Sign-in is wired up and working, and the Site URL is the last thing wrong.**
   Verified end to end against the live project on 2026-09-12, with every test
   account deleted afterwards.

   **THE SITE URL POINTS AT A DEPLOYMENT-PROTECTED VERCEL URL, AND THAT IS THE
   "it sent me to a Vercel login" BUG.** It is
   `https://far-east-far-east.vercel.app/`, which 302s to `vercel.com/sso-api`
   and on to `vercel.com/login`. **It should be `https://far-east-beta.vercel.app`**
   (Authentication → URL Configuration → Site URL). It is not breaking the
   normal paths today, because both real origins are on the allow-list — but the
   Site URL is where GoTrue sends **anything that is not**, so every future
   mis-typed or newly-added redirect lands on a Vercel login screen instead of
   this site, which is a bewildering thing to debug twice.

   **The two switches that had to be right are both in one panel**
   (Authentication → Providers → Email), and it is easy to hit the wrong one —
   it happened during this work, taking the provider off entirely and making
   things worse than before. The target state is **provider ON, "Confirm email"
   OFF**. Confirm email must be off because that mail is dead weight to this
   design — Google is what verifies a new account here, not an emailed link —
   and with no custom SMTP it goes through Supabase's shared mailer, capped at a
   couple an hour, past which `signUp` does not queue or degrade: it answers
   `over_email_send_rate_limit` and creates **nothing**. `mailerSpent`/`MAILER_SPENT`
   in `app/actions.ts` say so in plain words if it ever happens again.

   What is now confirmed working, against the live project:
   - `signUp` with a real address creates the account, autoconfirmed, carrying
     only an `email` identity. The session it returns is dropped on purpose in
     `splashAuthAction`, so Google is still the only way in.
   - The password really is saved at signup: signing in with it afterwards
     returns a session.
   - Both branches of the guard: no `google` row in `auth.identities` sends them
     to Google, one lets them through.
   - **Redirect URLs: `http://localhost:3000/**` and
     `https://far-east-beta.vercel.app/**` are both on the allow-list**, honoured
     exactly, tokens delivered to `/auth/callback`.

   **HOW TO TEST THE ALLOW-LIST WITHOUT A GOOGLE ACCOUNT** — worth keeping,
   because the three obvious probes all give a FALSE PASS. Do not use these:
   `/auth/v1/authorize` echoes any `redirect_to` straight back, including
   `https://evil.example/steal`; `/auth/v1/recover?redirect_to=…` answers 200 for
   the same; and `state` is an opaque UUID in this GoTrue, not a JWT carrying a
   `referrer` claim. What DOES work: GoTrue validates every `redirect_to` against
   one list whatever the flow, so send a **magic link** (`/auth/v1/otp`) carrying
   the URL under test to a disposable inbox with a public API
   (`inboxkitten.com`; read it with `mail/list?recipient=` then
   `mail/getHtml?key=&region=` — the param is `key`, not `mailKey`), pull the
   `/auth/v1/verify` link out of the mail, and fetch it **without following
   redirects**. The `Location` is the answer: the URL you asked for if it is
   allow-listed, the Site URL if it is not. **Always run the `evil.example`
   control in the same pass** — without it, "honoured exactly" cannot be told
   apart from GoTrue echoing blindly, which is the exact trap the first three
   probes fell into. There is a per-address cooldown, so use a fresh address per
   probe.

   Two smaller things: GoTrue validates the address's **domain** at signup
   (`email_address_invalid` for a made-up one), which is why
   `.verify/temp-user.mjs` inserts into `auth.users` directly and never goes
   through GoTrue; and a signed-in press still cannot be verified end to end
   locally — the DB layer under it is covered by `npm run verify:db` instead.
8. **The pack shelf has no shelf page.** `/favorites` lists catalogue products
   through `favoritesWithNotes`; `pack_favorites` is a separate table and
   nothing renders it yet, so a bookmark can be added and not seen anywhere
   else, and not removed. `savedPackIds()` in `lib/db.ts` is the query that
   page will want.
9. **The artwork pages are still centred on half pixels.** `styleFor` in
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
- **A hold on a phone is a long-press, and a long-press is a browser gesture.**
  iOS answers it on a link, button or image with a callout (open in new tab,
  save image) and Android starts a text selection with handles; either takes
  the gesture, and the splash's press-and-hold could not complete — the owner
  found the door would not open on a phone. Every pressable on the site, and
  every image inside one, now declines all three (`-webkit-touch-callout: none`,
  `user-select: none`, `-webkit-tap-highlight-color: transparent`) in one rule
  in `globals.css`, kept in step with the pressable-pointer list; holds and
  drags — the splash hit, the seal, the plus and its wheels, the cigarette row
  — also cancel `contextmenu`, which Android raises on a long-press whatever
  the CSS says. Fields are exempt: selecting the text in one is how it is
  edited. **Chrome on Windows cannot show `-webkit-touch-callout`** — it drops
  the declaration from the CSSOM — so check the built stylesheet for it, not
  a computed style. And a new pressable needs adding to that list. (This note
  itself was first written through a double-quoted shell string, which
  command-substituted its backticks and stripped every code span — the
  heredoc gotcha below, in a second form. Patch text with the editor.)
- **React's `onWheel` is passive, so a handler there cannot cancel the
  scroll.** React registers `wheel` (and `touchstart`/`touchmove`) listeners
  passive on the root, so `preventDefault` in an `onWheel` prop is refused —
  Chrome logs "Unable to preventDefault inside passive event listener" — and
  the page scrolls anyway. The quantity wheels had exactly that: rolling a
  stripe on the shelf, which scrolls, scrolled the page behind it. Anything
  that must cancel a wheel goes on with `addEventListener('wheel', h, {
  passive: false })` — as the cigarette row already did, and the wheels do
  now (a ref carries the latest handler so the one listener never goes
  stale).
- **`setPointerCapture` throws, so guard it.** It raises `NotFoundError` /
  `InvalidPointerId` when the pointer is not active by the time the handler
  runs — a finger already lifted, or a scripted pointer whose id the browser
  never issued. Unguarded in `CigQuantity`'s press it threw BEFORE
  `setMode('open')`, so the menu silently never opened. Every capture and
  release on the site is now wrapped in `try { … } catch { /* no pointer */ }`,
  the way the splash always was; losing capture only costs a one-gesture
  slide, never the press itself.
- **The Browser pane cannot time or paint animation, and it fakes it two
  ways.** It starves `requestAnimationFrame` (0–2 frames a second, even
  fronted) and clamps timers to ~500ms, so anything rAF-driven — the splash's
  hold, the seal's run — sits at its first phase for ever, and a CSS transition
  read after 1s is still at its start (the OFFERS hover "did not dim"; read
  again later it had). Both looked like site bugs for an afternoon. To drive an
  rAF loop there, shim it with a `MessageChannel` (which the pane does not
  throttle), never a timer; to read a transition, wait several seconds or
  read the rule, not the computed value. And its scripted pointers have ids the
  browser never issued, so `setPointerCapture` throws for them — stub it on
  `Element.prototype` for a test, and read the guard above.
- **A `'use server'` module may only export async functions.** Exporting a plain
  `const` from `app/actions.ts` does not fail the build and does not fail
  `tsc --noEmit` — it silently strips EVERY export from the module, and the first
  sign is a runtime error in the browser saying "the module has no exports at
  all" for an action that was obviously there. `lib/authPolicy.ts` exists because
  of this: `EMAIL_RE` and `MIN_PASSWORD` are shared by the splash overlay and the
  action, so they live in a plain module both can import.
- **Run `next build` with the dev server STOPPED** — both write to `.next`, and
  doing it live leaves the dev server serving Internal Server Error until `.next`
  is deleted and it is restarted. `NEXT_DIST_DIR=.next-build` is the way round it,
  but then `git checkout -- tsconfig.json next-env.d.ts` afterwards.
- **Heredocs on this machine eat one level of backslash.** Writing file content
  straight into `cat > f <<'EOF'` is fine, but a JS *string literal* containing
  `\s` or `\b` inside a heredoc arrives as `s`, which the string literal then
  eats again — leaving a bare `s`, or a literal backspace. It has cost real time
  four times now: a regex that silently matches nothing drops elements from a
  page without erroring. **Use the Write tool for any patch script with a regex
  in it.**
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
