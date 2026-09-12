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
  canvas draws over the page's own logo rather than replacing it — frame 0 IS that logo, and
  both put their ink at exactly 46,28, which is measured in the build, not assumed.
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
  owner's face, measured once in Chrome. It is what lets the build know where a
  line of text actually starts and stops, which is what the title's ink top is
  measured from. Regenerate it the same way if the face ever changes.

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

**OFFERS, My Saved and RECOMMENDED answer a pointer the same way**: the whole
button drops to 50%, and a 5px dash appears one space after the word. Pressed,
both go to 25%. (Those were 75 and 50 at first; the owner asked for another 25
off each.) The dash is a `::after` INSIDE the button, so the button's own
opacity carries it — which is what "the same opacity as the text" means at both
steps without either number being written twice. The gap is each label's OWN
space, because the three are drawn at different sizes (51.5, 18.9 and 18.1px):
a space is 0.32em in the owner's face, and the dash sits on the middle of the
x-height measured from that label's baseline. All of it is off the ink in
`scripts/assets/far-east-ink.json`, like everything else on these pages. The
block is in `globals.css` under "the three landing labels".

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
  line-height:1 box, measured in Chrome).
- **Every pack is centred on one axis — the logo's centre line** (`SHELF_AXIS_X`,
  65), at the row's own red rule, one pack height for all (aspect from
  `cigs.json`); the boxes, panel and clouds keep the design's distance from that
  axis. The owner's rule ("align the cigarette images on their middle axis"),
  and the design's own: its five rules share a centre at ~73, its logo's. The
  row is shifted by `DX` (-8) to put that on the site's logo. (It was briefly
  left-aligned on the margin instead; the owner's later instruction is the
  axis.) The rows are scaled with `zoom` anchored on the axis, so a pack stays
  centred on the logo at any zoom.
- **The rows are scaled to 80% of the fit** (`ROW_SHRINK`): the factor that
  would land the clouds on the right margin, less a fifth — the owner's "scale
  all the cigarette stuff down 20%". Their right edge therefore sits inside the
  margin; the header, price and divider still meet it.
- **The logo is as wide as the top pack, about its own centre** — the owner's
  rule, "use its current centre of mass as a guide". The stage sizes it live
  (`topPackWidth × zoom`, real width and height so the vector stays sharp) with
  its centre fixed at the landing page's (65, 71.5). **Its height is clamped**
  (`SHELF_LOGO.maxHeight`, 131): the top may not leave the page and the bottom
  may not pass the foot of the price's ink, the header's own baseline. On a
  desktop the zoomed pack is 100+px wide and a logo that wide is 250 tall —
  off the page and through the divider — so there it grows to 60 wide; at
  every phone and tablet width the pack's width fits and it takes it exactly.
- **On the shelf the logo is a link home, not the menu.** The logo menu's first
  frame IS the 40x87 logo, baked; it cannot sit on a rescaled mark without
  every frame being redrawn. `/landing`, per the logo-goes-home rule.
- **The quantity ("2c") is centred in its box** — equal margins to the rule above
  and below, the digit's ink (its ascent is the run's tallest) being what is
  centred. Placed relative to the inside of the rule.
- **The price is bold and the caption's box takes its width.** The face has one
  weight, so bold is a stroke on the glyphs (`-webkit-text-stroke`, 0.03 of the
  size, the age gate's trick), hung so the INK's right edge — stroke included —
  sits on the margin. The "Click # When Finished" box is the price ink's width,
  right edge and top where they were; the caption is centred inside it and
  scaled until its tightest margin to the rule is 3px (the sides bind; the top
  and bottom come out ~12). **Both are measured in the page** by `ShelfStage`
  on a canvas with the elements' own computed fonts once the faces are loaded,
  because `$` and `#` come from the fallback face and the ink table can only
  estimate them; and the caption is measured a second time at its final size,
  since type set small does not scale exactly from type set large (that was
  1.7px of a 3px margin). The table's figures are the first paint.
- **The margins are symmetric, and everything meets the right one, at any
  width.** The owner's rule: the aligned right edge holds the same margin from
  the page's right as the logo holds from its left. The logo is left-anchored in
  real px, so the right must be too — `--aligned-right` is `width - MARGIN`,
  measured live by `components/ShelfStage.tsx`, not a fixed design x. The header
  box and the $240 **move** (not scale — "keep the same ratios") to hang from
  that edge; the divider spans margin to margin; and the rows **scale up** as one
  block so their right edge (the clouds) lands on it (`--row-scale`,
  `rowScaleFor`). **There is no cap** — the owner asked for the mirror at their
  own width, so a desktop gets big rows; that is the instruction.
- **The rows are scaled with `zoom`, NOT `transform: scale`.** A transform
  scales finished pixels, and at 2x the type, the rules and the packs all went
  soft — the owner saw it. `zoom` lays the block out again at the new size, so
  type is set at the size it shows at, rules draw at their zoomed weight, and
  the packs come from their 3x rasters. `zoom` multiplies the block's OWN
  offsets too, so `.shelf-rows` has its `top` divided out to stay put and its
  `left` set so the left margin is the point that does not move
  (`A(1-z)/z`). The stage's height grows with the zoom. Chrome floors a zoomed
  border (3px at 2.58 draws 7, not 7.74), so inset marks can sit <1px off.
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
