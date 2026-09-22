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
  and `build:cigpages` (the phone pages embed the face). See "The owner's own
  face". (`build:shelf` used to be on that list; the shelf is a grid now and
  reads no baked geometry — it sets its own type live, off the ink table.)
- `npm run audit:cigtext` — estimates every line of type on the built cigarette
  pages against the box it sits in and lists the tight ones, worst first, with
  the width it had in the original digits beside it. Run it after a font change.
- `npm run build:menu` / `npm run build:growmenu` — bake the logo menus into
  `public/menu` + `lib/menu-geometry.json`, and `public/growmenu` +
  `lib/growmenu-geometry.json` **and `public/shelfmenu` +
  `lib/shelfmenu-geometry.json`: `build:growmenu` runs the one script TWICE,
  the second time with `shelf`, which is the same bake pointed at a fourth
  word.** The bar menu is baked from the owner's
  `monkey-bar.gif`. **The grow menu's animation is GENERATED** (`scripts/lib/
  ink-growth.mjs`); `monkey-grow.gif` is opened only for its words and the
  scale they are laid out on. Each bake takes about five seconds, MEASURES
  everything it can and stops rather than guessing, and `GROW_DEBUG=1 node
  scripts/build-grow-menu.mjs` draws the finished network on its own instead
  of the frames. **It also cuts the button's mark** out of
  `scripts/assets/mountain.svg` and writes the page's still of it
  (`public/growmenu/badge.webp`), so a change to the mountain means running
  this. See "The logo menu" below.
- `npm run build:dotsglyph` / `npm run build:dotsmenu` — the row's DOTS button
  and the menu that grows out of it. The glyph traces the owner's three spirals
  (`scripts/assets/dots.jpg`) into `lib/dotsGlyph.ts`, **lying down**, because the
  page stands them up with a quarter turn it drops on press; `GLYPH_OPEN=<px>
  GLYPH_PREVIEW=1` draws the button both ways round at 21/30/60px. The menu bake
  is the grow menu's machinery pointed at the other three words — SAVED, OFFERS,
  RECOMMENDED, cut from `monkey-grow.gif` and written by generated ink — and
  writes `public/dotsmenu/frames` + `lib/dotsmenu-geometry.json` in a few
  seconds. `DOTS_DEBUG=1` draws the finished network instead of the frames and
  `DOTS_PROBE=1` dumps the buffer the canvas is measured in. See "THE DOTS" below.
- `npm run build:sealglyph` — cuts the owner's 遠東 out of
  `scripts/assets/logo-characters.svg`, lays the two characters side by side as
  their seal does and hollows them out into `lib/sealGlyph.ts`, the corner
  seal's mark. `SEAL_LINE=<px> SEAL_MARK=<px> SEAL_PREVIEW=1` draws it at
  48/66/132px each way round for looking. See "THE CORNER SEAL".
- `npm run build:searchglyph` — traces the owner's spiral glass
  (`scripts/assets/search-glass.jpg`) into `lib/searchGlyph.ts`, the row's search
  mark. `GLYPH_OPEN=<px> GLYPH_PREVIEW=1` draws the button at 21/30/60px for
  looking. See "THE MAGNIFYING GLASS SEARCHES THE ROW".
- `npm run build:splash` — the splash's 101 frames, `edge`/`settle`/`blackbox`/
  `phone-label.webp`, **and `boxfill.webp`** — the cloud pattern with the source's
  login square mirrored over, which is what patches that square out now that the
  box is a long rectangle. About 50 seconds, and **reproducible: the 101 frames
  came back byte-identical** when `boxfill` was added. It also publishes where the
  patch goes back down (`SPLASH_BOXFILL` in the generated `lib/splashEdgeProfile.ts`)
  as the crop's own whole pixels over the frame — half a pixel of slip there is a
  seam across the middle of the design. See "THE LOGIN BOX IS ONE LONG ROW".
- `npm run build:tile` — bakes the animated 發 out of the owner's tile GIF (`scripts/assets/fa-tile.gif`) into
  `public/tile/fa-char-strip-{1x,2x}.webp` (all 72 frames stacked; the page steps them) and
  `lib/tile-geometry.json`. Takes a few seconds, keeps the character and drops the tile's
  rings, and stops rather than guessing — see "The seal, the tile and the outline" below.
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
- **MAKING A SHARE WORTH $100 OR MORE ADDS ONE TO `profiles.big_shares`** — the number the
  landing page draws in the outline beside the sigil (migration `0006`, the owner's
  2026-09-17 ask). Three things about it:
  - **It is counted inside `createShare`'s own transaction**, off the rows just frozen in, so
    the count and the shares it counts are written together or not at all. Worth is
    `SUM(cigarettes.price_usd)` over the snapshot. `SHARE_MILESTONE` in `lib/db.ts` is the
    $100.
  - **It has to be stored, not derived.** A share's worth is the worth it had WHEN FROZEN;
    `share_items` keeps the products but the catalogue's prices can move underneath them, so
    the same link recomputed later could answer differently.
  - **It counts links MADE, not links live.** One live link at a time is the other rule, so a
    reader on a $100 shelf can raise the number by regenerating. That is what the ask says.
  - **THE SHARE IS OF THE CATALOGUE SHELF, WHICH IS NOT THE SHELF THE SIGIL BELONGS TO.**
    `share_items` references `cigarettes` — the 32 placeholder products from
    `lib/catalog.json`, which are the only things here with a `price_usd`. The seal, the
    bookmark, the quantity wheels and the sigil all belong to the PACK shelf
    (`pack_favorites`, the 247 photographed packs), which has quantity but no price and **no
    share link at all**. The counter is wired to the share link that exists. If the owner
    means the pack shelf, that shelf needs a share link and a price first.
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
  cigarette pages. Hovering the trigger unfolds it; pressing mid-run skips to the end;
  pressing it again or anything else runs it back at 2x. Frames are baked out and scrubbed
  on a canvas, because the animation has to be seeked, paused and run backwards and
  neither a GIF nor a CSS animation can be. **The cigarette pages' bar menu is baked from
  a GIF, and its frame 0 IS the page's own 遠東 logo**, measured to land on it rather than
  assumed. The landing page's grow menu is generated, and its frame 0 is the mountain
  button's mark.
- **THERE ARE THREE MENUS AND ONE COMPONENT.** They are the same machine — same scrub,
  same phases, same rules about pressing — and differ only in what was drawn and what the
  words do, so each is described entirely by its geometry JSON and none has its own copy
  of `LogoMenu`. `menu="bar"` (the default), `"grow"` or `"shelf"` picks one. **A fourth
  would be four lines**: an import, and an entry in `MENUS`, `PLAY_RATE` and `LATCH` —
  and the last two matter, because a name missing from them falls back to 1 and to
  `false`, i.e. the wrong speed and a menu that closes on any outside press.
  - **bar** — `npm run build:menu`, `scripts/assets/monkey-bar.gif`, `lib/menu-geometry.json`,
    `public/menu/`. A red box round the logo and three labelled boxes unfolding right, plus
    a fourth the bake synthesises for home. **The CIGARETTE PAGES use it** and need that
    fourth box, because there the logo is the menu's switch rather than a link. Its logo ink
    lands at 46,28.
  - **shelf** — the SAME bake as grow, run a second time with a fourth word (HOME) and
    its own output folder; `lib/shelfmenu-geometry.json`, `public/shelfmenu/`, 610x63
    design px against grow's 505x58. **The SHELF PAGE uses it**, since its 遠東 logo —
    which was its only way back to /landing — was replaced by this button on 2026-09-21.
    See "THE SHELF'S MENU" in the shelf section for how HOME is set and why the zoom has
    to be measured there.
  - **grow** — `npm run build:growmenu`, `lib/growmenu-geometry.json`,
    `public/growmenu/`. A mountain button, and ink that grows out of it carrying three
    words — about us, privacy policy, terms of service, in a row. **The LANDING PAGE uses
    it.** It carried six until 2026-09-20: MY SAVED, OFFERS and RECOMMENDED — the three
    labels that used to be printed on that page — hung under the button as a stack, and
    the owner then moved them to a button of their own ("I want you to remove these
    buttons from the mountain button's animation"). They are the DOTS menu now, below;
    this bake is three words and 58px tall where it was six and 149.
    **Only the words are the owner's drawing**: they are cut from
    `scripts/assets/monkey-grow.gif`'s last frame and everything that moves is generated —
    see the next entry. **And it does not close** (`LATCH`).
- **SINCE 2026-09-19 THE LANDING MENU GROWS OUT OF A MOUNTAIN BUTTON, AND THE ANIMATION IS
  GENERATED RATHER THAN THE GIF'S.** Three asks in a row got here. First: replace the
  character logo "and all instances of it in the animation" with "an outline box with a
  capital I from the webfont bolded inside", black, 10px off the page's top and left; the
  three top words each on one line at one size; the gaps between them doubled. Then: "scale
  all elements related to the I button including the button itself to be the same scale as
  the + button", and "make the text of the text buttons the same size as the reset button".
  Then, with the owner's mountain vector attached: "instead of an I make it the image ive
  attached with the same dimensions make the mountain black and the tipi black with a white
  outline the same thickness as the outline box. as the animation that reveals the text
  buttons plays use the animation that you made for the seal logo button where the black
  leaves traces in the white as if it is draining as the text is written. make sure the
  animation grows into the text like branches or flowing water that is interconnected but
  sprouts more connected paths as it flows outward."
  - **WHAT IS STILL THE GIF'S: THE SIX WORDS, AND ONLY THEM.** `monkey-grow.gif` is opened
    twice now — page 0 for the scale solve, the last page for the words — and its own
    animation is never drawn. The words are cut from that last frame (by then its vines
    have receded and it is the words and the drawn box), scaled, and laid out exactly as
    before: each top word so that its X-HEIGHT is the reset button's 15px in the owner's
    face (a drawing has no type size to copy; measured 8.68 / 8.55 / 7.71 → x0.946 / x0.959
    / x1.064), the two-line words split glyph by glyph and set on one line a word-space
    apart, the gaps between words doubled, the stack moved up under the button. Everything
    that layout rests on is still measured every build and the build still stops if the gif
    is not what it expects.
  - **THE BUTTON'S MARK IS THE OWNER'S MOUNTAIN** (`scripts/assets/mountain.svg`, cut by
    `scripts/lib/badge-mark.mjs`). The vector is a picture — red sky, white mountain, black
    tipi — and the mark is made by dropping the sky, making the mountain the ink, and
    putting a white rule of the box's own weight (2px) round the tipi, which is otherwise
    the same black as the mountain it sits on. **The three regions are read off a RENDER,
    not out of the path data**: the mountain is not a shape in the file at all, it is the
    paper the sky does not cover. The white rule stands OUTSIDE the tipi and is clipped to
    the silhouette, so where the tipi's own edge IS the summit nothing is drawn and nothing
    spills into the sky. Drawn 27 x 23.94 inside the 29px the rule leaves: **standing on
    the inner foot with a pixel of air at each side**, because the picture is full-bleed
    and drawn any larger it merges with three sides of the box and the button stops reading
    as a box.
  - **THE BUTTON IS A TENTH BIGGER THAN THE PLUS** (the owner's "please make the button
    10% bigger", after their earlier "the same scale as the + button"): 33px against the
    plus's 30, and it still takes the row's scale, so the tenth holds at any size — measured
    live at 23.81px against the plus's 21.64, a ratio of 1.1004. **The 2px rule did not
    scale with it** (2.2 would land on a fraction and go soft), and it is the same 2px round
    the tipi, which is what "the same thickness as the outline box" means. The mark inside
    therefore grew by an eighth rather than a tenth, since the rule and the pixel of air are
    fixed. THE WORDS MOVED WITH IT: the top row hangs from the button's right edge and its
    middle line, so it went 3px right and 1.5px down, and the stack hangs from the button's
    foot, so it went 3px down. Both are the rules the owner's earlier asks set; the button
    growing is what moved them.
  - **THE MARK IS DRAWN BY THE CANVAS, NOT THE PAGE, BECAUSE IT DRAINS.** At rest the
    canvas is invisible, so the page shows `public/growmenu/badge.webp` — **a still the
    bake cuts out of the animation's own frame 0**, the same pixels, which is what makes
    the handover invisible. (A vector here against a raster there is exactly the mismatch
    the 遠東 logo was reported for: "it changed opacity when you hovered it".) Frame 0 is
    asserted to hold ink inside the mark's box and nowhere else, and the badge image is
    hidden by CSS for any phase but `idle`.
    **It is a sibling of the canvas, not a child of the button.** Inside the button it was
    placed from the PADDING edge, and Chrome snaps a zoomed border to whole local px (1.43
    drawn as 1.0 at the row's 0.7), so the still sat about half a pixel off where the
    canvas draws the same mark and the two jogged as one took over from the other — 0.45px
    at zoom 0.7, 0.74px at 1.356, measured. In the canvas's own coordinates they agree to
    0.01px at every zoom.
  - **THE GROWTH IS GENERATED** — `scripts/lib/ink-growth.mjs`, seeded, so a rebuild is
    byte-identical. A CHANNEL is a polyline with a tapering width, a start time and a
    speed, drawn up to wherever its front has reached; four things come off one, and the
    four together are the owner's sentence:
      * a **bypass** leaves the channel and REJOINS it further along, bowing out — a
        braided stream's island. This is the interconnection: a tree can only split.
      * a **branch** leaves at a shallow angle, bends back toward the run so it travels
        alongside its parent, and sprouts in its turn.
      * a **fork**, past the run's halfway, doubles a branch — "sprouts more connected
        paths as it flows outward", said again.
      * a **twig** is short and ends in a **curl**, an Archimedean spiral whose radius runs
        out: the seal's cloud filigree, which is what the drawing this menu came from is
        made of.
    Children are spawned at gaps that SHORTEN with distance along the run (21 → 8 page px
    on the top row), so the network thickens outward rather than thinning, and `linkTips`
    joins tips that ended up near one another AND POINTING THE SAME WAY — without that test
    a link is a straight tick drawn across the channel, which is the opposite of a join.
  - **THE WORDS ARE NOT A WALL; THEIR GLYPHS THIN THE STROKE OVER THEM.** The row's words
    fill the middle of that band from end to end, and the first bake kept the growth out of
    their boxes — which left the row with a fringe on one side and every downward child cut
    to a tick. Now a channel may cross a word: the word plate, blurred by a page px, is a
    `gmask` on `Ink.stroke`, and the drawn half-width is `hw * (1 - 0.92 * glyph)`, so a
    stroke thins to nothing over a letter and threads between them. It is the single line
    that makes the growth WRITE the words rather than score them through. The top trunk
    then weaves — over one word, under the next, crossing in the gaps where there is
    nothing to cross — which is what gives it both strips to sprout into.
  - **EACH WORD IS WRITTEN BY THE CHANNEL THAT PASSES IT**, not by a wipe. Every pixel of a
    word has an arrival distance `T` = how far along the writer the nearest point on it is,
    plus 0.9 of how far off the channel it sits, plus two octaves of SPATIAL noise; it comes
    up when the front has passed that distance, over 7px of soak. So a letter grows out of
    the stroke going past it with a ragged wet edge, and because the noise is of place and
    never of time the edge cannot shimmer. The front keeps advancing at the same pace after
    its channel has stopped, or the last letters of a word are never reached.
  - **THE INK LEAVES BY THINNING, NOT BY BEING CUT BACK.** Over the last fifth every point
    loses width, latest arrival first (`erode` on `Ink.stroke`), so a stroke goes hairline
    and then goes — the seal's "black leaves traces in the white", in the same arithmetic
    the mark drains by. Retracting the fronts instead reads as a film run backwards.
  - **THE MARK DRAINS BY THE SAME CLOCK, AND WHAT IS LEFT IS TRACES.** Ink is taken out of
    the mountain in order of its distance THROUGH THE INK from the two points the network
    leaves by — the box's right edge on the row's middle line, and the foot — so it empties
    from the spouts inward. Two things make what is left read as veins rather than as a
    bite: the step cost carries a **capillary term** (`1 - 0.45*exp(-depth/2.2px)`), so thin
    ink holds longest and the silhouette keeps its own outline as it empties; and a `keep`
    field protects the contour, the tipi with its white rule, and **two veins grown by the
    same generator, rooted at the same two spouts, with a curl on each** — order from the
    physics. **The residue is the outline and the tipi, and nothing else**: there were
    VEINS in there too — two runs up from the two spouts with a curl on each, grown by the
    same generator as the branches outside so that what the mark kept was of a piece with
    what left it — and the owner had them out ("remove the stray black stroke inside the
    drained mountain"). At 24px they were not filigree: the longer of the two read as a
    scratch from the base to the summit. A mountain this small has room for its own outline
    and no more; the generator is still there for anything bigger.
  - **THE SKY FILLS BEFORE ANYTHING LEAVES THE BOX, AND THE MARK STAYS DRAINED UNTIL THE
    MENU IS CLOSED** (the owner's asks: "make it so the sky fills before it spreads out of
    the outline"; "the mountain remains drained at the end until the animation is fully
    reversed … until the menu is closed"). Both are ONE FIELD and one number:
    `LEVEL[i]` puts every pixel of the mark on a dial — 0.08..0.90 for the mountain
    (1 - its distance from the spouts) and 1.05..2.0 for the sky, by height — and a pixel
    carries ink while the dial stands at or above it. The dial runs **1 to 2.08 over the
    first 12% of the run** (the sky fills as a level rising round the mountain; nothing
    grows), **holds full for a beat** (`SPREAD`, three frames — measured on the first cut,
    the sky reached 100% on the very frame the first ink crossed the outline, which is true
    to the ask with nothing to see it by; it is now full at frame 17 and the first ink
    leaves at 20, 158ms later as played),
    **2.08 to 0 over the growth** (the level falls back down the sky), **and then stays at
    0**. So the mark is drained for as long as the menu is open.
    The dial's ends are kept clear of the soft edge (0.08..0.90, not 0..1) so that the
    resting frame is SOLID and the drained one is empty rather than half-grey.
  - **AND THE MOUNTAIN DRAINS AS THE BOX FILLS** (the owner's 2026-09-20 "make it so the
    mountain drains as the outline fills"). One field, TWO HANDS on it, going opposite
    ways: `sky` is the dial above, unchanged, and `mtn` runs 1 -> 0 over exactly the
    stretch the sky comes up. The mountain gives its ink to the box rather than waiting
    for the growth to take it, and it reaches 0 as the box reaches full — so by the time
    anything leaves the outline the mark is already a white mountain in a black box, and
    it stays that way for the rest of the run. It used to hold full through the fill and
    drain over the growth instead.
  - **THE KEYLINE CLOSES BEHIND IT.** The sky is held a line's width off the silhouette
    (below) so that a full sky over a FULL mountain is not one black rectangle — but a
    drained mountain is white, and the gap then drew a second, redundant edge round it:
    white keyline, black contour, white interior. The gap is scaled by the mountain's own
    dial, so it is the full line while there is black to separate and nothing at all once
    the mountain is a white shape in a black box.
  - **THE SKY STOPS A LINE SHORT OF THE MOUNTAIN.** Both are black, so a full sky over a
    full mountain would be one black rectangle with the drawing gone; the sky's ink is held
    off the silhouette by the width of the line the drain leaves behind, so the mountain
    stays there as a white keyline — the same keyline the drain ends on. (Left to the
    antialiasing the edge came out a half-covered grey seam that looked like this by
    accident; this is the same picture, measured.)
  - **THE LANDING MENU CLOSES ONLY BY ITS OWN BUTTON** — two asks of the owner's, in the
    order they came: "make the last frame of the animation the new default after the full
    animation plays regardless of user input", and then "on click on the mountain button
    everything retracts and the animation plays in reverse". `LATCH` in `LogoMenu` is the
    table, beside `PLAY_RATE` and for the same reason: it is a judgement about one menu,
    not a property of the drawing. **THE LATCH IS ABOUT THE END OF THE ANIMATION, NOT THE
    MIDDLE OF IT**, and the full state machine is:
    - hovering the button runs it forward;
    - **taking the pointer off it MID-RUN turns it straight around** (the owner's "if a
      user hovers over the mountain button but removes their cursor without clicking
      before the animation is finished, reverse the animation from the current point until
      it is completely reset or the user hovers over the button again"), and it retracts
      from wherever it had got to until it is back at rest — or until the pointer comes
      back, which turns it around again from that point;
    - a press MID-RUN skips to the end, because that lands on the same last frame the run
      was going to anyway;
    - **once the run has FINISHED, the last frame is the resting state**: leaving does
      nothing, pressing the page does nothing, pressing a word that goes nowhere does
      nothing;
    - **and the one thing that takes it back from there is a press on the button**, which
      runs the whole thing backwards at 2x — the branches retract, the ink comes home and
      the mark fills, being the same frames the other way.
    So the landing page's resting state after a completed run is the three words standing
    and the mountain drained, until the reader presses the mountain again. Verified in the
    page: forward → (leave) reverse → idle; forward → (leave, then hover) forward; open →
    (leave, hover, page press, word press) still open; open → (button press) reverse. **The BAR menu is not latched**: on the
    cigarette pages anything pressed elsewhere closes it, because it sits over the page's
    own logo and that is how a reader gets the page back.
    - **Worth knowing about the close, since it is a REVERSE SCRUB of the same frames**: it
      necessarily replays the sky fill backwards at the end, so the button floods black for
      about 680ms just before it settles. That is what "the animation plays in reverse"
      gives; making the close anything other than those frames run backwards would mean
      baking a second set.
  - **THE CANVAS STARTS ABOVE THE BUTTON.** The growth reaches over the top row, so the
    canvas is given that room (`SHIFT`, measured off the finished network, capped at the
    margin) and the button sits at 0,`SHIFT` inside it. **`place` is therefore where the
    BUTTON goes, not the canvas's corner**: the offset is in menu px and shrinks with the
    zoom while the page's 10px margin must not, so the stylesheet divides the margin by the
    zoom and takes the offset off after (`--logo-menu-ox/oy`). Measured in the page at zoom
    0.7: the button on 10,10 exactly.
  - **`GROW_DEBUG=1 node scripts/build-grow-menu.mjs`** draws the whole finished network on
    its own, one colour per kind of child, and stops. It is the only way to judge the shape
    — a frame shows what has grown so far, which is not the same thing — and it is what
    caught the ticks, the stubs and the fishbone in the first three attempts.
  - **What the build checks, and what it measured on the way in:** 59 channels and 1824px
    of run (82 and 2487 for the shelf's four-word variant; it was 113 and 3306 while this
    menu still carried six words); the words all cut with 0 px of the last frame falling outside their boxes;
    frame 0 the mark alone; the last frame the words and the mark with 0 px of growth left
    over. Verified in the page: the button on 10,10 at the row's scale and a tenth bigger
    than the plus (1.1004), the mark drained while the menu is open (409 against 1604 at
    rest) and the page's own copy of it hidden meanwhile, the words written in reading
    order, and the hover dim exact (88 mean alpha at rest, 44 hovered, 22 held, 88 again on
    leave).
- **How a word answers the pointer is the geometry's `hover`.** `invert` is the bar's: the
  box fills and the label reverses out, which cannot be painted over the frame (the label
  would go with it), so the bake writes a second image per box. `dim` is the grow menu's:
  its words have no box to fill, so the word's own rect is CLEARED and the frame drawn back
  into it at 50% under the pointer and 25% held — which is exactly what OFFERS, My Saved and
  RECOMMENDED did as page parts. Clearing first is what makes it a dim; drawing at half
  alpha over the word already there would only darken it. Nothing is baked, so the two
  states cannot drift apart. Verified in the page: 154.8 mean alpha at rest, 82.8 hovered,
  45.8 held, back to 154.8 exactly on leave.
- **HOW FAST EACH MENU PLAYS IS `PLAY_RATE` IN THE COMPONENT, NOT THE GEOMETRY.**
  `frameMs` there is the gif's own measured rate and stays a measurement; this is the
  preference, and it is per menu because it is a judgement about one of them — the owner
  asked for the grow menu 20% slower than its gif (2026-09-17), so it runs at **0.8** and
  takes 7.4s where the frames' own rate gives 5.9. (It was 10.3s against 8.3 when the run
  was the gif's whole 197 frames; it has been 142 since the top row was re-laid.) The bar is untouched at 1. Reverse is
  `REVERSE_RATE` times whatever forward is doing, so "backwards at twice the speed" holds
  at any rate. (It spent an afternoon at 0.88 and came back: that 10% was asked for against
  a view that was ramping, so it was judging the pane's frame supply rather than this
  number. **Judge a rate in a real browser window, never in the pane** — see the gotchas.)
- **A word that is not a link is a button carrying `data-part`.** My Saved's is `saved` —
  the same attribute it had as a page part, so `CigScroller`'s capture-phase listener spins
  the row with no change at all. OFFERS and RECOMMENDED are `inert`: drawn, hoverable and
  going nowhere, as they were on the page. **Not `disabled`** — a disabled control takes no
  pointer events in Chrome, so it would stop answering the pointer as well.
- **The grow menu weighs 1.13MB** (142 frames, 1010x116 device px), against the bar's
  953KB — and the shelf's four-word variant 1.42MB at 1220x126, which is a second set of
  frames and the price of the fourth word. (The 2.3MB/926x328 this note used to give was
  from when the menu carried six words.) It was 2.2MB while it was still the gif re-composited, 2.9MB when it grew out of
  the logo at the drawing's own size, and 3.5MB before the logo came out of those frames —
  that mark was being stored 197 times over. It loads on `requestIdleCallback`, after the
  page's own artwork. That is what the frames genuinely cost: every ink pixel is pure
  black, and storing the alpha channel alone comes to the same bytes, so WebP is already
  exploiting it — **and lossy WebP is not an option, because sharp silently keeps lossless
  for an image with an alpha channel** (q10 and lossless came back byte-identical). The
  lever, if it is ever needed, is `SS` in the bake: 1 instead of 2 quarters the pixels and
  costs sharpness on a dense screen.
- **The frames carry no white.** The GROW menu's are generated straight into alpha, so
  there is nothing to undo; what follows is the BAR menu's bake (and was the grow menu's
  while it came from its gif). The gif paints its background white and 90% of a finished
  frame was opaque white, which cut across whatever the canvas sat on — on the cigarette
  pages, the red rule round the info. The bake un-multiplies every frame out of white on
  the way out:
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
- **`/dev/desktop` shows any page as a desktop browser draws it** (the owner's 2026-09-19
  "make the dev accurate to the appearance of the website on desktop"). The Claude app's
  preview pane is about half a screen wide, and these pages lay out against the window's
  real edges, so the pane shows the narrow-window version of everything. `/dev/desktop`
  loads the site in a frame laid out at the SCREEN's own size — `screen.width` by the
  available height less 85px for Chrome's tab strip and toolbar (1920x947 on the owner's
  1080p screen) — and scales the whole frame down to fit the pane. It is the real page:
  clicks, scrolling and sign-in all work through the scale, and the address follows the
  page inside so a reload stays put. `?path=/about`, `?w=1440&h=820` override. A route
  handler (`app/dev/desktop/route.ts`), so the root layout is not wrapped round the frame
  too; 404 in production. **Emulating a size in the pane itself does not stick** — the app
  clears it at the end of each turn — which is why this exists. `devIndicators: false` in
  `next.config.mjs` takes Next's "N" badge off dev pages for the same reason; error
  overlays still show.

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

Baked animations (the splash, the seal, the cigarette pages' bar menu) are GIF frames
rendered to WebP and scrubbed on a canvas, because a GIF cannot be seeked, paused or
reversed. **The landing page's menu is the exception: its frames are GENERATED** (see "The
logo menu"), and they are scrubbed the same way. `lib/useFrameScrub.ts` is the
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

**AT REST, A PACK IS DEAD CENTRE AND THE RED FRAME IS ON IT — always** (the
owner's 2026-09-19 "make sure the selector red rectangle always ends up on the
middle image by the end of the scroll"). Four things broke it, all fixed in
`CigScroller`, and each is worth knowing before touching the tick:
- **The row's width is worked out, not read off the row.** `measure()` used to
  take `el.clientWidth` straight after `setZoom(z)` — state, not yet applied —
  so the width was the OLD zoom's (on a first load, the whole screen's: 1100
  where the row is 582) and the middle the settle aimed at was out by the same
  factor. Every scroll ended with the frame near the right edge (x=1040 of
  1100, measured). It only came right when the applied zoom resized the row and
  the ResizeObserver ran again, and a view that is not painting delivers no
  ResizeObserver callbacks at all, so there it never did. The width is now the
  (unzoomed) box the row stretches across, over the zoom just decided.
- **A resize re-centres the FRAMED pack** (`offFramed`), not whichever pack is
  nearest the new middle, and anything a measure leaves unfinished starts the
  tick. A window listener covers a change of height alone, which moves the zoom
  without resizing the row.
- **The stop test asks the rule itself**: with nothing steering the row and no
  pack within half a pixel of the middle, it is settling. A late tick braking
  straight to 0, a seek landing on a stale target and a resize mid-motion all
  used to stop the timer off-centre. The settle's last half pixel is snapped,
  so the rest position is exact rather than wherever the exponential gave up.
- **A mouse released off the row ends the drag.** The row captures only once a
  press is really a drag, so a press that slid off the band first was released
  elsewhere, `draggingRef` stayed true, the settle was shut out, and the row
  then followed the bare mouse. The release is heard from the window too, and a
  mouse move with no button down ends it.
Checked in the pane at 1100 wide: load, a wheel throw, a press on a far pack,
the arrow keys, a drag with a fling and a press slid off the band all rest with
the frame on the middle pack, within a pixel.

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

**THE MAGNIFYING GLASS SEARCHES THE ROW** (the owner's 2026-09-19 ask, with
their spiral glass attached: "turn this image into a magnifying glass icon that
is the same style as the + button … put it in a outline box that is the same
size as the + button's … a button that when clicked closes all other open menus
around it and opens a text editor with the dashed lines and sigil of the text
editor in the login box … when a user types in the text editor bar and hits
enter or search check every cigarette for tags or name or brand and pull up any
matching cigarettes the same way you do for the my saved button. if there are
no hits have the sigil flash red and delete whatever is written").
`components/CigSearch.tsx`, `lib/cigSearch.ts`, `lib/searchGlyph.ts`.
- **THE MARK IS TRACED** (`npm run build:searchglyph`). The owner supplied a
  picture, not a vector, and the button inverts under the pointer, so — as for
  the plus and the minus — it has to be drawn inline and filled with
  `currentColor`. The image is thresholded, its boundaries walked by marching
  squares and thinned with Douglas-Peucker: two loops, 403 points, 4.7KB of
  path, filled EVEN-ODD so the spirals need no bookkeeping. Straight segments,
  not fitted curves — it is drawn 75 times smaller than it is traced.
  **THE WHITE IS OPENED UP BY 12PX BEFORE TRACING** (`OPEN`). The spirals' cuts
  are a third of a pixel at the size the row draws the mark, and a browser
  antialiases a cut that thin to grey: untouched, the lens arrived as a dark
  blob on a stick. Looked at in the real button at the real zooms (0.72, 1,
  1.83) for openings 0 / 9 / 12 / 14 / 16: 12 is where the lens first reads as
  a RING at 21px and the owner's triskele is still whole at 55. Sized by the
  plus's rule — its long side is the plus's 16.
  **AND THE HANDLE IS CUT SHORT** (`HANDLE`, 1.75 lens radii — the owner's
  2026-09-20 "make it so the magnifying glass has a shorter handle so it can be
  more evenly situated relative to the outline"). As drawn the tail reaches 2.6
  radii, which left the mark a third wider than tall with the lens shoved into
  one corner. The cut is an ARC ABOUT THE LENS'S OWN CENTRE, which the build
  finds rather than being told: the lens is the disc touching the picture's
  left and top edges, so its centre is the middle of the ink on each of those
  edges and its radius the distance to them, and the build stops if that comes
  out anywhere unexpected. So the handle ends square to its own direction. At
  1.75 the mark is 1.23 wide for its height and ITS INK'S CENTRE OF MASS IS THE
  BOX'S CENTRE to within a tenth of a unit, so it needs no nudging — checked
  against centring it by its mass and by its lens, which look the same and
  worse respectively.
- **WHERE IT STANDS** is worked out in `layoutMenu` with everything else, from
  the row AT REST: its centre is halfway between the right edge of the pack
  left of the framed one (one `CIG_GAP` before the framed pack begins) and the
  plus's left edge, and halfway between the red frame's foot and the plus's
  top. Measured live at 1790x914: 62.5 / 63.0px either side, 56.9 / 57.0 above
  and below, the same 21px box as the plus. **Never read it off a moving row**:
  through one wheel throw its left edge would swing 860 → 304 → 794 → 739 →
  858, which is the failure `cigTagsRight` once had. It does hop a few px when
  the row settles on a pack of another width (3.8 to 10.9 between ordinary
  neighbours), as the menu beside it does, and slides there.
- **IT IS THE MENU'S CONSTRUCTION AGAIN**: `.cig-search` placed in screen px,
  `.cig-search-scale` carrying the plus's zoom. A SIBLING of `.cig-menu`, not a
  child — the menu's box slides when the plus is pressed and this stands by the
  plus's shut place. Open, it slides onto the frame's left edge at its own
  height and the bar runs to the frame's right (`MENU_DESIGN_W`, so the same
  `MENU_MIN_ZOOM` overflow on a narrow frame as the tag menu has).
- **THE BAR IS THE WHOLE ROW AND THE GLASS FADES OUT OF ITS WAY** (the owner's
  2026-09-20 "when the text editor is created the magnifying button fades out
  and the bar takes up the entire row from edge to edge of the red outline").
  So the bar is `MENU_DESIGN_W` — the width the menu is scaled to, which IS the
  frame — starting at 0 rather than one gap past the button, and the glass is
  drawn over its left end while it is shut and fades as it arrives. **The glass
  is `inert` while the bar is out**: a button nobody can see is not one anybody
  should be able to press or tab to. That leaves three ways back — Escape, a
  hand on the row, and **Enter on an empty bar**, which is why that last one
  exists. The bar follows the frame after a search re-lays the row.
  - **AND IT IS THE FRAME'S WIDTH TO THE PIXEL, measured off the frame AS
    DRAWN** (the owner's "the dashed line is a little wider than the edges of
    the red outline"). Two things had it over: `openLeft` is rounded, and the
    model's idea of the frame's edge is up to a px from the drawn one, because
    the slot under it rounds its own left in row px. So `fitBar` reads the
    `.cig-frame` rect — the one element that does NOT move with the row, being
    always centred — and uses it where it agrees with the model to within a
    few px, the model where it does not, which is only ever mid-motion.
  - **AND IT STOPS ONE ☁ SHORT OF THE DOTS BUTTON** (the owner's 2026-09-20
    "make the dashed line for the magnifying glass text editor stop one sigil
    length from the 3 dots button"). The bar starts at the frame's left edge
    and the dots button stands INSIDE the frame's right end — it is placed
    between the plus and the pack beyond it, not at the frame's edge — so the
    dashes were running straight through it. `searchLineW` in `lib/cigSearch.ts`
    takes the room between the two, measured in the BAR'S OWN px (its left
    edge to the button's, over both zooms), and takes one ☁ off it.
    **IT IS CUT, NOT SCALED.** The sprite is still drawn `box` px across, so
    the dashes keep the length, the spacing and the wander they were drawn
    with and the windows onto them simply stop earlier; scaling the sprite
    down to the shorter length would have taken the type and the ☁ with it and
    set the field three quarters of its size. Every other figure in
    `CIG_SEARCH` stays a fraction of the DESIGN width for the same reason —
    `lineW` is the only thing the row measures on the page. The typing room
    (`avail`) follows the cut, so a long query starts shrinking sooner.
    **THERE IS NO FLOOR UNDER IT, and there was one for an afternoon.** A
    floor applied after the ☁ is taken off gives the line back the very gap
    it was asked to keep: at 390px it clamped the line up to 74.8 bar px
    where the room was 96.6, and the ☁ — the thing the gap is measured in —
    came down on the dots button. The rule is exact, so it is kept exactly,
    and on a window too narrow to hold a field the line simply runs out;
    the bar is unusable at that size for other reasons already (the frame it
    is scaled to is 66px wide there). Measured: the line ends 29.0px short of
    the dots at 1920 against a 30px ☁, and 20.0 short at 1280 against a 20px
    ☁, and still starts exactly on the frame's left edge.
  - **A second zoom takes up the rest** (`--cig-bar-fit`), because where the
    menu's own zoom has hit MENU_MIN_ZOOM the menu is deliberately wider than
    the frame and the bar went with it. It floors at `BAR_MIN_FIT` 0.68, under
    which the field's type would fall below 16px and iOS would zoom the whole
    page on focus and not zoom back; there the bar stops shrinking and runs
    past the frame, as the tag menu does. Measured: dead on the frame's edges
    at 1920 (fit 1) and 1280 (0.694); 33px past at 961 and 76px on a phone.
    The bar is anchored `bottom: 0` so that zoom shrinks it upward and its
    line stays on the row's own foot.
- **THE BAR IS A ROW OF THE LOGIN BOX, LARGER, AND ITS DASHES ARE THE LOGIN
  BOX'S OWN.** That box's marks are not CSS: they are one hand-drawn sprite,
  `public/splash/blackbox.webp`, shown through windows. The same windows are
  used here at this bar's size (the SUBMIT row's line, the straightest of the
  three), so the runs are irregular and the line wanders, as drawn — a
  `border-bottom: dashed` would be a ruled mark beside the real one. Every
  size is a FRACTION OF THE LINE'S LENGTH measured off that sprite (☁ 0.151,
  type 0.113, text start 0.0204), so it is "the same row, bigger" at any width.
  The ☁ is `/sigil.webp` as a MASK over a coloured block, so that going red is
  one colour changing. A long query is set smaller on the same baseline.
  **A TENTH OFF THE HEIGHT OF BOTH** (the owner's 2026-09-20 ask): the line is
  scaled in Y alone — a drawn line has only its height to give, so its dashes
  come out a tenth thinner while their length and spacing are untouched — and
  the ☁ is scaled BOTH WAYS by that tenth. Its height is 10% less, which is
  what was asked; scaling one axis of a mark redraws it, and this one is the
  owner's.
- **THE ☁ IS THE CARET** (the owner's 2026-09-20 "when the user clicks on the
  text editor have the sigil start blinking instead of outright disappearing.
  have it mark where the next text will appear"). It used to step aside the
  moment anything was typed, as the login box's does. Now it stands at the end
  of the typed run — measured on a canvas with the field's own font at the size
  it is actually set, clamped to the line's end for a query long enough to
  scroll — and blinks while the field has the caret, on `steps(1)` so it is a
  caret's hard on-off rather than a pulse. **The browser's own caret is turned
  off** (`caret-color: transparent`): there is no sense in two marks saying the
  same thing. The mark is keyed on the query in the markup, so every keystroke
  restarts the blink solid, which is what a real caret does. A reader who has
  asked for less motion gets a mark that stays put. Measured in a real window
  (the Browser pane reports its tab hidden, so it delivers no focus events and
  cannot see any of this): the blink runs, sampled opacity 1,1,1,1,1,0,0,0,0,0,
  1,1 over 1.2s, and the mark rides the text at 859 → 927 → 1056.
- **IT ARRIVES LEFT TO RIGHT ON THE COMPOSITOR**, the tag menu's own way —
  opacity and a 10px drift, nearest first on the same stagger. That is why the
  dashed line is shown in EIGHT windows rather than one: one would fade in all
  at once, and a clip or a growing width is a repaint every frame, which this
  block was already rewritten once to get away from. Shut, the bar is `inert`.
- **THE BUTTON IS ALSO "SEARCH"** ("hits enter or search"): shut, a press opens
  the bar; open with something typed, it searches as Enter does; open and
  empty, it shuts. Escape shuts it. It and the tag menu are never open together
  — each one's button puts the other away — and the four things that put the
  tag menu away when the reader starts to scroll (`closeMenus`) put this away
  too. **"All other open menus around it" is the tag menu.** The mountain's
  menu in the corner is left alone: the owner's earlier rule is that only its
  own button closes it.
- **THE MATCH RULE** (`searchPacks`): fold the query and the index the same way
  (lower case, accents folded, anything but a letter, a digit or `$` a space),
  and a pack matches when EVERY word of the query is a whole word of the pack or
  the START of one. A pack answers to its name (always `Brand — Variant`), its
  brand as the tag menu names it, and its tags BY THE WORDS ON THE BUTTONS —
  "menthol", not "Y"; "$25" and the bare "25" both. **NOT A SUBSTRING, and that
  is measured**: "esse" as a substring returns 127 packs, because "Dessert"
  contains it, against the 14 that are ESSE. It runs entirely in the browser —
  both manifests are in the row's bundle already; My Saved goes to the server
  only because a shelf belongs to a reader.
  - **Not indexed: the raw tasting notes and pairings.** `cigtags.json` carries
    only the five families of each, so "mint chocolate" finds nothing and
    "strawberry" finds the one pack named for it rather than the ten that taste
    of it. Carrying the 112 + 207 raw values is 6.4KB gzip and a line in
    `build:cigtags`; the owner asked for "tags or name or brand", so it is not
    done.
- **A HIT GOES THROUGH `startSpin`**, the same throw, lap, catch and handover as
  My Saved, reset and confirm — four buttons, one code path. **NOTHING FOUND IS
  DECIDED BEFORE THE WHEEL IS THROWN**: handed an empty list, `startSpin` spins
  a whole lap and `swapTo` then leaves the row alone, two seconds of motion
  that changes nothing. Instead the ☁ goes `#FF0000` at once (the artwork's
  red, not `--negative`), holds 500ms and fades over 150 — the login box's own
  rejection, aimed at the sigil — and what was typed is deleted. Verified in
  the page: "zzzz" → field empty, ☁ rgb(255,0,0) at once and rgb(1,1,1) again
  within the second, the caret back at the line's start; "esse menthol" → the
  row spins and holds exactly the 8 packs the data says.
- **WHAT AN ADVERSARIAL PASS FOUND, all fixed**: "goldenleaf" and "golden leaf"
  each found only the packs sharing that spelling (the data has two brand
  buttons) — a brand now answers to every spelling in its group, 7 packs either
  way; the line's window caught the foot of the "g" in the sprite's "create
  account/login" as a smudge over the dashes, so it starts at 0.8915 rather
  than the splash's 0.887; after a hit the glass could only search again, never
  close, so it now shuts the bar when the text is what it last found; a search
  asked for mid-spin was dropped without a sign and is now held until the row
  lands; Escape worked only from the field, not the glass; shutting dropped
  focus on BODY and now hands it to the glass; the type's floor is in SCREEN px
  (9, or 16 on a touch screen, under which iOS zooms the page and does not zoom
  back) and counts BOTH zooms, the menu's and the bar's own `--cig-bar-fit`,
  which runs to 0.68 — dividing by the menu's alone overstated the floor by
  half again on a narrow window; and on a coarse pointer both toggles get an
  invisible 38px target while shut. **Left as they are**: "hard" and "mid" also find the packs NAMED
  "Hard Pack" and "Mid-Size", which is the name being searched as asked;
  "cannabis" finds all 247, every pack having a strain; and the prefix rule
  lets "esse" find Guiyan Essence.
- **NEVER PATCH THIS FILE WITH `String.replace(a, b)` AND A STRING `b`.** A
  replacement string reads a dollar sign followed by a backtick as "everything
  before the match", and these notes are full of exactly that pair: commit
  8862fb1 shipped this file with its first 893 lines pasted into the middle of
  a sentence. Pass a FUNCTION — `s.replace(a, () => b)`.
- **A new pressable joins THREE lists** at the foot of `globals.css` (touch
  callout, the white cloud, the held cloud) as well as the shared control rule
  and its focus ring — `.cig-search-toggle` is in all five. Its computed cursor
  was checked: the white cloud.

**THE DOTS OPEN SAVED, OFFERS AND RECOMMENDED** (the owner's 2026-09-20 ask,
with their three spirals attached: "create another button within a box outline
mirrored from the magnifying glass button using this attached image. they will
share the same properties and parameters but on press the dots will turn 90
degrees so they are horizontal then grow into the saved, offers and recommended
buttons currently attached to the mountain button's animation. I want you to
remove these buttons from the mountain button's animation, shorten my saved to
just saved and make sure the letters have the same margins as the letters in
offers and recommended. use the same branching animation but have them grow
from the outline around the dots freezing when the words are fully revealed the
branches are at their apex. the words should be aligned on the left like they
currently are but rescaled to be the width of two rows in the tag menu that
gets opened by the + button. keep the same margins otherwise. only have the
animation and the word buttons retract when another menu near it is opened or
when the 3 dots button is pressed again").
**Then, the same day, two more:** "have the word buttons grow from the left
side of the button not the right", and "have the branch that connects to the
outline retract after the words are fully grown but leave the other branches
connected to the words and the one on the left until the 3 dots button is
pressed again".
`components/CigDots.tsx`, `scripts/build-dots-menu.mjs`, `lib/dotsGlyph.ts`,
`lib/dotsmenu-geometry.json`, `public/dotsmenu/`.
- **IT IS THE GLASS MIRRORED, AND THAT IS THE WHOLE PLACEMENT RULE.** The glass
  stands halfway between the pack left of the framed one and the plus's left
  edge; this stands halfway between the plus's RIGHT edge and the pack to the
  right, on the same line, in the same 30-design-px box at the same scale
  (`dotsLeft` in `layoutMenu`). Worked from the model of the row AT REST like
  everything else there. Measured at 1920: both centres on their midpoints to
  within half a pixel, all three buttons 22x22, all on top 709 but the plus.
  - **It is held on the page**, by its LEFT edge since the words went that
    way: the drawing reaches 225 design px left of the button, and the clamp
    keeps that much of the page clear. It does not bite at any width measured
    (the drawing's left lands at 44, 59, 534 and 875 at 360, 390, 1280 and
    1920, against a 12px margin) — the mirror puts the button right of the
    middle and the reach is about a sixth of a screen. It is there for the
    case nobody thinks to try, a wide pack on a narrow window.
  - **THE WORDS CROSS THE GLASS ON A NARROW WINDOW, AND THE GLASS STAYS.**
    They grow left along this line, which is the glass's line, and the room
    between the two buttons is the framed pack's width and a bit: at 1920
    with a mean pack they clear the glass by 15px, at 1600 they are 7px into
    it, at 1280 by 35. **The owner's word is "dont make the magnifying button
    disappear when the 3 dot menu is open"** (2026-09-20), so it does not.
    Two answers were tried and taken out before that one: standing the glass
    down only where a word would really be printed through it, which made it
    appear and disappear as the reader scrolled the row (the room IS the
    framed pack's width, and a hand on the row leaves this menu standing —
    measured at 1600x900, three flips in twelve packs); and standing it down
    whenever the words were painted, which is what the owner refused.
    **So the glass is drawn OVER the lettering and stays pressable**:
    `.cig-controls > .cig-search` takes `z-index: 2`, because the dots come
    after it in the markup and OFFERS' own box would otherwise lie on top of
    the glass and swallow the press. Checked at 1280 and 1920 with the words
    out: `elementFromPoint` at the glass's middle is the glass, it is opaque
    and not inert, and pressing it opens the bar and closes the dots.
    `.cig-menu` comes later again, so the plus still has the top of the pile.
    **`DOTS_WORDS` is left in `CigDots` unread**: it is the measure anything
    reasoning about where the lettering lands will want.
  - **AND THE DRAWING IS SCALED TO THE ROOM BETWEEN THE FRAME AND THE PLUS**
    (`dotsDraw`). The button is the plus's size because it is the plus's
    mirror, and that size follows the FRAMED PACK: the widest pack in the
    catalogue (Fiit Menthol, 108 row px) gives a menu zoom of 1.37 where a
    mean one gives 0.73, and at 2560 it reaches 1.83. The words hang three
    lines deep off a line with the red frame close above and the plus's line
    close below, so at those zooms they ran **31px up into the red frame and
    down onto the plus** (measured at 1920x947 with that pack framed; worse on
    a shorter window, worse again at 2560). The room each way from the ink's
    own line is half the distance between the frame's foot and the plus's top
    — the owner put the button midway between them — and the drawing takes as
    much of the menu's scale as fits in it. **It is 1 for all but the three
    widest packs.** It is scaled about the button's left edge at its middle,
    which is the point the ink leaves from, so the first stroke comes out of
    the same place whatever the scale. Its floor is `MENU_MIN_ZOOM` **on the
    scale the words are SEEN at** rather than on the fraction — two thirds of
    1.83 is still bigger than a mean pack's 0.73, so a floor on the fraction
    was both too tight and too loose at once. Measured with the widest pack
    framed at 1920x947, 1920x860, 2560x1080 and 3440x1440: the canvas clears
    the frame by 2-4px and the plus by 8-10px, with SAVED 13 to 20px tall.
- **THE MARK IS STORED LYING DOWN** (`npm run build:dotsglyph`). The owner drew
  a column and asked for it to TURN on press, so the path is written with its
  dots in a row — the tailed one on the left — and the button carries
  `rotate(-90deg)` at rest, which it drops when pressed, over the same time the
  first branches take to leave the box. The state that is HELD is the
  untransformed one, which is why it is stored that way round. Traced by the
  shared `scripts/lib/trace-mark.mjs` and opened up by 7px first, for the
  reason the glass is: the spirals' cuts are a third of a pixel at this size.
  **Its long side is 22, not the plus's 16** — it is a column of three, and at
  16 each dot is 4.8px across and reads as a smudge; at 22 (2px clear inside
  the rule) they read as three, upright and turned. The BOX is the glass's to
  the pixel, which is what "the same properties and parameters" is about.
- **THE MENU IS THE GROW MENU'S MACHINERY POINTED AT THE OTHER THREE WORDS.**
  Same generated ink (`scripts/lib/ink-growth.mjs`), same `useFrameScrub`, same
  hover dim. 124 frames, 1.4MB, canvas 261x132 design px with the button at
  225,54 inside it — the words hang to its LEFT, so it is no longer in the
  canvas's corner and `logoHit` is what says where it is.
  - **THE TRUNK GOES ROUND THE TOP, and that is the words' own alignment
    talking.** Two channels where there was one: a REACH out of the button's
    left edge at its middle, climbing over the top of the block and turning
    down at its far corner, and a SPINE down that far edge past the three
    words with a feeder going right along each one. Round, because the words
    are LEFT-ALIGNED: the edge all three start at is the one FURTHEST from the
    button, and the near edge is where they END, ragged — SAVED and OFFERS
    stop 90px short of RECOMMENDED. A spine hugging the button would have to
    throw that 90px as a bare diagonal across nothing before either of their
    feeders reached a letter. Round the top, every feeder meets its word in
    five pixels, each word is still written LEFT TO RIGHT and the three still
    arrive in reading order. **Mirroring the whole picture instead would have
    written every word backwards**, which reads as the animation running in
    reverse.
  - **The reach is a SHOOT**: three times the spine's length in two thirds of
    its time (0.26 against 0.4), so the wind-up before the first letter is a
    third of the run rather than half of it. It is never bare — it sprouts the
    whole way, at the network's own pace.
  - **THE THREE ARE SET AT ONE SIZE, matched on the X-HEIGHT.** The gif drew MY
    SAVED a third taller than the other two, which read as a heading over them
    while it still said "MY SAVED"; cut down to one word it is just a different
    size of type. So each is scaled to the x-height OFFERS and RECOMMENDED
    share (x0.708 / x1.022 / x0.979) and then all three together to the block's
    width — the owner's "make sure the letters have the same margins as the
    letters in offers and recommended".
  - **SAVED is cut out of MY SAVED at the widest gap inside the word**, which
    is the space the owner drew rather than a guess, and what is kept starts at
    the S. The build stops if it cannot find one.
  - **The block is 186 design px wide** — two tag buttons and the gap between
    them, which is what a heading in that grid spans ("rescaled to be the width
    of two rows in the tag menu"). Every word's LEFT EDGE is the block's, and
    the vertical gaps are the drawn ones at the block's scale ("keep the same
    margins otherwise").
  - **IT FREEZES AT THE APEX — AND THEN THE REACH WINDS BACK IN.** The run
    has two phases: 100 frames of growth ending at the apex exactly as before,
    then 24 of the REACH and everything hanging off it withdrawing into the
    button, leaving the spine down the left, the three feeders and the words
    standing. That is the owner's "have the branch that connects to the
    outline retract after the words are fully grown but leave the other
    branches connected to the words and the one on the left". The last frame
    is the resting state; coming back is the whole thing in reverse at the
    scrub's 2x — one bake, both directions — so pressing the button reaches
    back out to the words before taking them away, which is what a reverse
    scrub of this run IS.
  - **IT WITHDRAWS THE WAY IT CAME, AND SO DOES EVERYTHING ON IT.** The reach
    is drawn from the button to a front that retreats from its tip, so the
    last ink to go is at the button. Each child is drawn to the same fraction
    of its own length measured from where it is rooted — `len x
    clamp((out - detach) / (1 - detach))` — so the family empties together
    and each piece runs out exactly as the front passes the place it grew
    from. **`detach` is the child's BIRTH TIME as a fraction of the reach's
    run**, which for anything growing straight off it IS its arc position
    (`sprout` births a child at parent.t0 + its arc fraction x parent.dur).
    A child of a child is born LATER, so its detach is LARGER, so `out`
    passes it SOONER and it goes before the branch carrying it — which is the
    order wanted, by the opposite arithmetic to the one first written here.
  - **NOTHING MAY VANISH IN A SINGLE FRAME**, which is what a detach of 1
    means: the window `1 - detach` is what the channel has to empty in. The
    ratio is not bounded by the reach's clock — a child of a child grows at
    the network's pace while the reach is a shoot — so three of the thirty
    (two curled twigs and a link, 74px of run) came out at 1.005 to 1.057,
    were clamped to 1, and were switched OFF on the first pull frame rather
    than retracted: 149 device px going dark in 42ms, five times the next
    frame's rate, at the corner where the reach hands over to the spine.
    `PULL_MIN` (0.15) is the least window any of them may have. **The build
    now measures the pull frame by frame** and fails if the worst single
    frame sheds more than three times the mean — a whole curl disappearing at
    once is invisible in a still and obvious in motion. It reads 139.5 px a
    frame with a worst of 330 (x2.37), and that worst is the middle of the
    pull, where `easeInOut` genuinely moves fastest.
  - **THE TWO FAMILIES ARE KEPT APART FROM THE MOMENT THEY ARE GROWN**, joins
    included: `linkTips` is run WITHIN `goes` and within `stays` and never
    across, because a link between them would be left hanging in the air the
    moment the reach withdrew.
  - **The build proves the reach has gone**, and it does it on the pixels: the
    leaving family is drawn whole, every pixel that the staying family and the
    words do NOT also cover is collected, and the resting frame must not light
    one of them. (Asked naively it failed on 311 px, all of them shared with
    the spine, a word or a curl that stays.) The apex frame carries the checks
    that used to be on the last frame — every word whole, nothing on the
    canvas border — because the apex is now the fullest the picture gets.
    Measured in the page: the ink rises to 22,614 device px at the apex and
    rests at 19,256, and there is nothing at all left in the canvas's top
    right, which is where the reach's arc was.
  - **The canvas is MEASURED OFF THE DRAWN NETWORK, not worked out from the
    polylines.** Estimated from the points and their taper it came out five
    pixels short at the foot and the last frame had four strokes sliced off
    square along the bottom edge. The network is drawn once into a padded
    buffer, the ink box read back, and the last frame then has to have NOTHING
    on its border or the build fails. A flat cut is the one thing that says
    "picture" rather than "ink".
- **ONLY TWO THINGS CLOSE IT** — pressing the dots again, or another menu
  opening beside it — which is the owner's list and is why it is NOT in
  `closeMenus`. A hand on the row leaves it standing, where the tag menu and
  the search both go away. Verified: a wheel throw leaves it open; the plus and
  the glass each close it and it runs all the way back to 0 ink — and
  **the menu that closed it does not appear until it has**, which is "ONE
  MENU AT A TIME" below; this menu's 2.6s exit is why that rule exists.
- **The dim is CUT OUT of the frame** (`decorate`), not painted over it:
  `destination-out` at 0.5 takes half the coverage off the word's rect, so the
  ink comes out at half strength and the paper around it stays transparent —
  which it must, because this canvas lies over the moving row and a white
  scrim would put an opaque box on the packs. Measured in the page: 204.6 mean
  alpha at rest, 105.2 hovered, 55 held, 204.6 again on leave.
  - **WHICH WORD AND WHETHER IT IS HELD ARE TWO PIECES OF STATE.** Chrome
    focuses a button on pointerdown, so `onFocus` fires immediately after the
    press; while the two were one object, focusing put `held` back to false in
    the same breath as the press set it and the word never reached its quarter
    strength.
- **SAVED carries `data-part="saved"`**, the attribute it had under the
  mountain, so `CigScroller`'s capture-phase listener spins the row for it with
  no change at all; OFFERS and RECOMMENDED are drawn, hoverable and go nowhere,
  and are NOT `disabled` (a disabled control takes no pointer events). A shut
  menu's words are `inert`. Verified signed out: pressing SAVED starts the spin
  and then the action sends the reader to the splash with `next=/landing`,
  which is the shelf's own rule and not this menu's business.

**THE CORNER SEAL** (three asks of the owner's on 2026-09-20, with their seal
artwork attached: "turn just the chinese characters in this image into a
square seal button 2x as big as the mountain button in the right corner of
the screen with 10px margins on its top and right edges. Make the characters
just a black outline"; then "stretch the characters so they are a square
together"; then "make them two seperate characters in square outlines and
scale them to be individually square but make them 1 button with 5px margin
between"). `components/CornerSeal.tsx`, `lib/sealGlyph.ts`,
`npm run build:sealglyph`.
- **THE CHARACTERS COME OFF THE OWNER'S OWN VECTOR, not the picture.** The
  same 遠東 is already in the repo as `scripts/assets/logo-characters.svg` —
  the landing page's logo, which the seal in that picture is set from — so
  tracing a screenshot of them would cost fidelity for nothing. They are
  STACKED there and SIDE BY SIDE in the seal, so the build cuts each one out
  and lays the pair out again the way the seal does, **with the gap the owner
  drew them with**: 192px against a 657px character, 29%, measured off the
  render rather than chosen. The two are split at the LARGEST gap between
  bands of ink, not at a threshold — a character's own strokes leave gaps too
  (26px inside 遠), and a threshold set between those two numbers would work
  today and break on the next drawing.
- **TWO SQUARES, ONE BUTTON.** Each character is cut on its own and
  stretched into its own square — which costs it a part in five hundred, the
  two being 639x637 and 675x675 as drawn — and the page puts a box round each
  with the owner's 5px between. One `<Link>` wraps the pair, so there is one
  press target, one focus ring and one hover: both boxes invert together.
  There is no shared field and no strip any more.
  - **It got here in three steps, and the middle one is worth keeping.** The
    pair first sat side by side at their drawn proportion in one square,
    which left that square mostly air; stretched to fill it together (2.30x
    taller) they read as a cut seal, and that stretch is what first made the
    outline legible — it took the ink the 1.2px line keeps from 82% to 53%.
    Given a box each they are bigger again (each character now fills 58
    design px where it had 27 of a shared 58), so the hollows are plainer
    still: 38.4% and 34.1% of the ink kept.
  - **The gap is in PAGE px, the boxes in design px.** 5px on the screen at
    any width, like the 10px margins on the same button, while the squares
    scale with the row as the mountain does — the stylesheet divides the gap
    by the zoom. Measured at 1920x947: two 48x48 boxes, gap exactly 5, each
    2.00x the mountain, 10 from the top and 10 from the right.
- **"JUST A BLACK OUTLINE" IS A RING**: the silhouette less the silhouette
  eroded by the line's width, traced by the shared `scripts/lib/trace-mark.mjs`
  as one even-odd path, so it fills with `currentColor` and inverts with its
  box like every other mark on this page. The line is stated in the px the
  mark is DRAWN at (1.2 of 58) and converted into the trace's scale, because
  it is a line on the page rather than a fraction of a character. The build
  stops if the ring keeps more than 90% of the ink — at that point the line is
  thicker than the strokes and the "outline" is just the character again (2.4
  trips it; 1.8 is legal and heavy; 1.2 keeps 53%).
  - **THE STRETCH COMES FIRST, THE RING SECOND.** Scaling a finished outline
    would scale its line with it, and the mark would carry a heavier line
    across the top of every stroke than down its side. Stretched first and
    eroded after, there is one line all the way round. The stretch is tiny
    now that each character has its own square, but the order is the same so
    the reason does not have to be rediscovered — it mattered when the pair
    shared a field and was stretched 2.3x.
- **IT IS THE MOUNTAIN BUTTON'S MIRROR.** Twice `logoHit.w` out of the grow
  menu's geometry (66 design px against 33), the same `badge.rule`, drawn at
  the same `--logo-menu-zoom` the row publishes on the stage so the two keep
  their ratio at every width, and the same 10px margin — measured from the
  page's top and RIGHT where the mountain takes top and left. Measured in the
  page at 1920x947: 48x48 against the mountain's 24x24, exactly 2.00x, 10px
  from both edges.
  - **The rule stays 2px.** Doubling the box does not double its line: every
    box on these pages carries the same 2px, and the seal in the owner's
    artwork draws its own frame at about 4% of its width, which at 66 is 2.6.
  - **Each mark is 58 x 58 design px in the 62 its rule leaves**, 2px of air
    all round, and 42 x 42 on screen at the row's own zoom. Judged at 48, 66
    and 120px a box against line widths of 0.7, 1.2 and 1.8: 1.2 is where the
    hollows first read at 48 and still look like a line at 120.
- **THE SQUARE IS PADDED WITH PAPER BEFORE THE RING IS TAKEN**, and the
  owner found out what happens when it is not: "at the top of both characters
  and at the very bottom there seems to be some sort of clipping". A
  character is cropped to its own ink, so its outermost strokes LIE ON the
  square's edges — and a distance transform only sees the buffer it is given,
  so with no pad it reads "off the top" as more ink rather than as paper. The
  top of the top stroke was then nowhere near any paper, fell outside the
  ring, and was drawn with no line along it. **Measured before the fix: 119
  and 329 px of 遠's edges and 138 and 138 of 東's carried silhouette but no
  outline.** The shared tracer pads for exactly this reason
  (`inkMask(src, { pad })`); this build makes its own raster and so has to do
  it itself, and **it is the same trap the mountain's `keep` field fell into**
  — "THE FRAME'S OWN EDGE COUNTS AS THE OUTSIDE" in build-grow-menu.mjs. Two
  scripts have now made it; a third will.
  - **So the build asks the edges directly**: every pixel of the silhouette
    lying on the square's own border must carry outline, because it is the
    outermost ink there is and so is boundary by definition. It reads 597 px
    for 遠 and 413 for 東, all of them outlined.
- **AND NOT ONE LINE MISSING ANYWHERE ELSE — THE BUILD PROVES THAT TOO** (the
  same ask). Three more things could quietly drop a stroke between the ring
  and the path: `MIN_AREA` throwing away a small loop, `simplify` collapsing
  a thin one, and the even-odd fill turning a loop inside out. None of them
  announces itself — the mark just loses a stroke — so the build **draws its
  own path back** at the size it traced and asks the pixels.
  - **Two measures, because either alone can be fooled.** A whole stroke
    inside a big loop is a per cent or two of that loop's pixels, so COVERAGE
    barely moves; and a ring that is complete but shifted would pass a purely
    local test. So: every connected piece of the ring must be at least 90%
    painted, AND no pixel of the ring may sit further from painted ink than
    the line's own width.
  - **It reads 5 and 6 pieces, the poorest 98.9% and 99.6% painted, the
    furthest any ring sits from ink 23.9 and 21.4px against the line's 33.1**
    — and those two worst points are a corner tip the tracing rounds, looked
    at magnified with the ring and the drawing overlaid in two colours: no
    part of the ring is unpainted anywhere.
  - **The guard was made to fail on purpose** before it was trusted: a copy of
    the build with `MIN_AREA` at 40000, which throws away every small loop,
    stops with "character 1 has a piece of outline only 0.0% painted: a stroke
    is being lost". A check that cannot fire is worth nothing.
  - **BUT IT COULD NOT HAVE CAUGHT THE CLIPPING**, and that is the lesson
    worth keeping: it compares the PATH against the RING, so it proves the
    drawing faithful to the ring — and the ring was itself short at the
    edges. A check is only as good as the thing it checks against. The edge
    test above compares the ring against the CHARACTER, which is the other
    half of the question.
  - **The proof needs the pad too.** The path's own box is the ring's, which
    sits `PAD` inside the buffer, so the viewBox it is drawn back through is
    widened by that much in the path's own units. Rendered at 0,0 the mark is
    stretched over the pad and every comparison is nonsense — it read 41%
    painted the first time, which was the pad's shift, not a lost stroke.
  - **And nothing is lost at the SIZE IT IS DRAWN either**: rendered at 42px
    (the mark on a 1x screen), 58 and 84, the palest piece of either character
    still reaches 206 of 255 — none is faint, none invisible.
- **It goes to the shelf** (the owner chose, asked). A plain `<Link>`, not a
  button: it navigates, so a keyboard and a middle click should both get what
  they expect. The site's OTHER seal — `SealButton`, the animated one on the
  row's bar — still leads there too, on its second press.
- It is on both landing routes. On `/` it sits behind the splash, which is
  opaque there; checked with `elementFromPoint`.

**ONE MENU AT A TIME, AND THE NEXT WAITS FOR THE LAST TO GO** (the owner's
2026-09-20 "make sure the previously opened menu or button has fully
disappeared before the new menu or button appears"). The row has three menus
— the tag grid off the plus, the search bar off the glass, the words off the
dots — and they were three booleans, with each button setting the other two
false in the same breath. That CROSSED them: the dots' words take the whole
run backwards to leave, about 2.6 seconds, and the tag menu was arriving over
the top of them the whole way.
- **`openMenu` in `CigScroller` is now one piece of state** — `'tags' |
  'search' | 'dots' | null` — and `tagsOpen`, `searchOpen` and `dotsOpen` are
  read off it, so two of them cannot be true however the code is called.
- **`request(next)` is the only way in.** With nothing out it opens at once.
  With something out it closes that, remembers what was asked for, and opens
  it when the first has finished leaving. `MENU_EXIT_MS` is how long each
  takes: the tag menu and the search bar both slide their box back over
  `CIG_MENU_GROW_MS` (380) while their pieces fade over `CIG_MENU_SHUT_MS`
  (200), so the slide is what they cost; the dots are `DOTS_CLOSE_MS`, their
  124 frames at the scrub's 2x, 2604.
- **Asked back while it is still leaving, a menu turns around at once** rather
  than waiting to finish going: the scrub and the transitions all reverse
  from wherever they have reached, so it reads as one movement, and a reader
  pressing the same button twice means it.
- **A second request while something is leaving replaces the queued one and
  does NOT restart the wait** — the one that is leaving has been leaving all
  this time. Pressing the plus and then the glass opens the search; pressing
  the plus twice opens the tag menu once.
- **A hand on the row takes the queue back too.** `closeMenus` drops a queued
  tag menu or search as well as an open one, because a reader who pressed the
  plus and then started scrolling has changed their mind. (It still leaves
  the dots alone, open or queued, which is the owner's earlier rule.)
- **The timings are one copy each.** `--cig-grow-ms` and `--cig-fade-ms` used
  to live in `globals.css` and are now set inline from `lib/cigRow.ts`
  alongside `--cig-shut-ms`, because the component has to know exactly how
  long a menu takes to leave. A number in both places would drift and the
  drift would show as an overlap.
- Verified in the page, sampling the dots' ink and the other two menus'
  opacity together every 200ms: pressing the plus or the glass with the words
  out gives **zero frames in which two menus are drawn at once** — the ink
  runs 19256 → 27 → 0 and only then does the other menu start to arrive — and
  the same for the quick pair (the tag menu's buttons reach 0 before the
  bar's first piece appears). Asked back mid-close, the dots return to their
  resting frame; the queue cases above were each checked too.

**THE PLUS BESIDE RESET OPENS A TAG FILTER FOR THE ROW** (the owner's
2026-09-14 ask; since 2026-09-19 the plus stands first on the row's edge and
reveals the rest of its line — see "The seal, the tile and the outline").
Four controls sit under the row's left end, all of them sized off the reset
button's 88x30 with 10 between — `CIG_CONTROLS` in `lib/cigRow.ts`
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
  (`[data-first]`). **Since 2026-09-19 the grid is TWO BUTTONS WIDE, always**,
  and the whole menu is scaled to the red frame's width — see "The menu under
  the red frame" below. (It used to reach right to the pack left of the
  framed one, `cigTagsRight`, with a phone fallback; that rule is gone.)
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
- **THE MENU UNDER THE RED FRAME** (the owner's 2026-09-19 ask: "move the +
  button under the middle cigarette aligned on its vertical axis equidistance
  between the end of the red outline and the bottom edge of the page. On menu
  open slide alignment with the left edge of the red outline and maintain the
  same top and bottom margins. Change to minus. Scale all elements including
  the + button to make the menu bar and menu catalogue fit within the edges of
  the red outline"). Everything the plus owns — the plus, the bar (seal, 發,
  outline, reset), confirm and the tag grid — is **one box**, `.cig-menu`,
  placed by `layoutMenu` in `CigScroller`:
  - **Shut**, the plus is centred under the middle pack, its line halfway
    between the frame's foot and the page's foot (measured at 1920x947: 136
    above, 137 below).
  - **Open**, the box slides left (a transition on `left`) until its left is
    the frame's left, **at the same height** — that is the reading of
    "maintain the same top and bottom margins". The grid under it runs down
    to 12px above the page's foot and scrolls inside that.
  - **Scaled to the frame.** The design width is confirm plus a two-button
    grid and its scrollbar (`MENU_DESIGN_W`, 299); the box's inner layer
    carries `zoom` = the frame's width over that, so the menu runs from the
    frame's left edge to its right edge. Zoom, not a transform — type is set
    at the size it is seen at. Inside the zoomed layer everything restarts at
    its corner in design px (`.cig-menu-scale` restates `--cig-top`,
    `--cig-col` and `--cig-line2`, because a custom property referring to
    another is resolved where it is declared).
  - **Worked from the model at rest, not read off the DOM**: at rest the
    framed pack is dead centre, so the frame is (pack width + 16) x the row's
    zoom, centred, and its foot is the page's middle plus half the frame's
    height. It is recomputed on every measure and whenever the row stops;
    **while the row moves the menu holds**, then slides to the new frame and
    takes its size when the row settles on a pack of another width (verified:
    zoom 0.73 on a 50-wide pack, 0.82 on a wider one, the grid's right edge
    on the frame's within a pixel both times).
  - **`MENU_MIN_ZOOM` (0.7) is a judgement**, not the owner's: below it the
    tags' type would fall under the 9px floor, so on a narrow window — and for
    the narrowest few packs even at 1920 — the menu stops shrinking and runs
    past the frame's right edge.
  - First placement does not animate (`data-slides` comes on a moment after
    `data-placed`), or the menu would slide in from the page's corner.
  - **IT CLOSES THE MOMENT THE READER STARTS TO SCROLL THE ROW** (the owner's
    2026-09-19 "make it so the menu automatically closes and plays the closing
    animation as soon as the user begins to scroll"), with the minus's own
    closing animation, because it is simply the same state set. Four places,
    one call each: the wheel on the row, the arrow keys (`nudge`), a press
    the moment it becomes a drag (past `SLOP`, so a click on a pack with a
    few px of wobble does not count), and pressing another pack to fetch it
    (`seekTo`). Scrolling the tag list itself does not close it, and nor does
    the row moving on its own — a spin from My Saved, reset or confirm; reset
    leaving the menu open is an earlier rule of the owner's. Verified: all four
    close it, the grid's own scroll and a sub-`SLOP` wobble do not, and at the
    moment of closing the slide back (`left`) and the bar's and tags' fades are
    all running transitions.
- **Confirm spins the row down to the matches** through `startSpin`, the same
  throw, lap, catch and handover My Saved and reset use — three buttons, one
  code path. **Reset drops every tag and leaves the menu open**, which the
  owner asked for: it undoes the filtering, not the reaching for it. A filter
  matching nothing leaves the row alone, as an empty shelf does (`swapTo`
  returns early). Verified end to end: Menthol + mid put exactly the 29 packs
  the manifest says, and only those, on the row.

**OFFERS, My Saved and RECOMMENDED ARE NO LONGER ON THE PAGE — they moved into
the logo menu** (the owner's 2026-09-16 ask, with the new drawing). The landing
page at rest is now the mountain button (which replaced the 遠東 logo there on
2026-09-19, by way of an I for a day — see "The logo menu") and the row with
its plus, and everything you can press beyond those is reached by hovering
that button. Three notes on what that took:
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

**The seal, the tile and the outline** — **ALL AT THE PLUS BUTTON'S SIZE, THE
OUTLINE HAS A NUMBER IN IT, AND ALL OF IT STANDS ON THE PLUS'S LINE, HIDDEN
UNTIL THE PLUS IS PRESSED** (the owner's asks: 2026-09-17 the size and the
number; 2026-09-19 the line, then the tile, reset to the end, the line moved
left and the reveal; then the whole menu moved under the red frame — "The menu
under the red frame" above). At rest **the plus stands alone, centred under the
middle pack**. Pressing it slides it onto the frame's left edge and reveals,
left to right, **the
seal, the animated 發, the outline with the number, and reset** — one gap (10)
between each, except the design's 3 between the 發 and the outline, which
was the cloud's; all 30 tall — along with confirm (which opens straight under
the plus) and the tag grid (beside confirm, where it always was). The top right
of the page is empty at rest, which is where the menu's words unfold.
`MARK_SIZE` in `lib/landing.ts` is `CIG_CONTROLS.height`, so the one number
comes from the button they are being matched to rather than being typed again.
- **THE REVEAL IS THE TAG MENU'S OWN.** `.cig-bar` holds each item in a
  `.cig-bar-slot` that fades in and drifts the last 10px out from the plus,
  nearest first on the same `--cig-stagger`, compositor-only, and gathers back
  on close. A shut bar is **`inert`** — out of the tab order, the accessibility
  tree and the pointer — since an invisible control that can still be pressed
  is a trap. The page passes its marks as a keyed ARRAY (`marks={[seal,
  sigil]}`); a fragment would arrive as one slot and stagger as one.
- (For a few hours the plus stood on the row's own 12px edge — a reading of
  "lined up vertically with the cigarette box above it". The owner then placed
  it under the middle pack, which settles what that meant.)
- **THE ANIMATED 發 REPLACED THE CLOUD — THE CHARACTER ALONE, NOT THE TILE**
  (`npm run build:tile`, `scripts/build-tile.mjs`). The owner's GIF
  (`scripts/assets/fa-tile.gif`) is a mahjong tile — three concentric rounded
  rings, 10, 8 and 5px, hard black on white — round a 發 whose cloud filigree
  moves on a 72-frame, 50ms loop; only the character animates. How it got to
  the character alone, all 2026-09-19:
  1. The whole tile went in at the outline's 30px with its corners redrawn
     square ("make the edges of the tile sharp"): the rings measured off the
     straight middle of every side and redrawn as square bands.
  2. The owner said it was not playing. It was, but at 30px the tile's
     character is about 16px across and its moving swirls are thinner than a
     pixel: 16 of 690 pixels changed visibly on a 1x screen. Sharpening per
     density (below) took that to 44 and it still read as still.
  3. Shown the tile playing at 30 to 120px, the owner chose: "remove the
     outline and just scale the character's dimensions and its animation up to
     be the same height as the rest of the bar". So the rings are **not drawn
     at all** — the bake still MEASURES them, because they are how it finds
     the face and proves that only the character moves and that the crop takes
     no sliver of a ring — and the crop is the character's own reach across all
     72 frames (444x446 source px), drawn **30x30**, nearly twice the size it
     had inside the tile. **309 of 900 pixels now change across the loop at
     1x**, and the swirls read as moving.
  **Two densities, each SHARPENED AT ITS OWN SIZE** after the reduction
  (`fa-char-strip-{1x,2x}.webp`, `srcSet` picks): a 1x screen handed a 2x file
  shrinks it again with the browser's own filter and blurs fine motion away.
  The bake stops if either would move less than 5%. A reader asking for
  reduced motion gets the first frame. **Note: drawing an animated image onto
  a canvas always gives its FIRST frame, by spec** — that cannot test whether
  one plays.
  **IT PLAYS, LOOPED, ONLY WHILE THE MENU IS OPEN** — the owner's clarified
  ask. So it is NOT an animated image: those run on the browser's own clock
  from the moment they load and cannot be started or stopped by the page. The
  bake writes each density as one tall strip of all 72 frames
  (`public/tile/fa-char-strip-{1x,2x}.webp`), `SigilMark` shows it through a
  window one frame high, and `.cig-bar[data-open] .sigil-tile img` steps it
  with `steps(72)` over 3.6s — a transform, on the compositor, landing on
  whole-pixel frame offsets. The animation exists only while the bar is open,
  so opening starts it at frame 0 and closing removes it. Verified with
  `getAnimations()`: none while shut; running from 0 when opened, looping past
  the last frame, every sampled offset a whole frame; gone again on close.
- **THE ROW LAYS THEM OUT, NOT THE ARTWORK SPEC.** That line's height is the
  band's at the live zoom — `--cig-top` on `.cig-controls`, known only on the
  client — so nothing placed from `LANDING_SPEC` could find it. `CigScroller`
  takes them as `marks`, adds its own reset at the end, and `.cig-bar` puts
  them one gap past the plus from the plus's own custom properties;
  `lib/landing.ts` only SIZES them now (`LANDING_MARKS`) and places the logo
  alone. `SealButton` gets `placed={false}` there and becomes a flex item;
  `components/SigilMark.tsx` is the tile, the outline and the number as one
  box. The seal, the cloud and the square are still cut by `build:landing`;
  putting any of them back in the corner is a line in the spec.
- **THE LINE IS ROUNDED TO A WHOLE PIXEL** — `top: round(var(--cig-top), 1px)`
  after the plain `top`, at every use of both lines. The zoom put the line at
  577.33 and the sigil and the square are vector `<img>`s, which a fractional
  top resamples row by row; reset and the plus, which always sat there, get a
  crisp rule out of it too. The rounding is at the use, not in the custom
  property, because a custom property cannot carry a fallback declaration.
- **The seal no longer stands down for the menu.** The `@media (max-width:
  482px)` rule that hid it while the menu was out came off with the corner;
  the cigarette pages keep their own copy, since their seal is still there.
- **WHAT IS SCALED TO 30 IS THE SQUARE, NOT THE PAIR**, and that is a
  judgement. The pair scaled to 30 wide puts the square at 12.8px with 11px
  inside its own stroke, and there is a NUMBER in there now — about 6px of
  type, under the 9px this site already knows is the floor for a line that has
  to render solid. Scaling the square to 30 leaves 25.9px inside, which sets
  the number at 13.5. The sigil keeps its drawn proportion either way and comes
  out 37x18.
- **THE NUMBER IS `profiles.big_shares`** — how many share links this reader
  has made worth $100 or more. `components/SigilMark.tsx` draws it as live
  type over the square rather than as artwork: every cut part is an `<img>`
  of an SVG and none carries a text node, so type on these pages goes on top,
  where the row's controls already set text in the owner's face. One size for
  every value, taken from the widest it can show ("100", 1.919em off the ink
  table), so it does not resize on reaching double figures. Signed-out reads 0.
- **`LANDING_ROW_CLEAR` STILL DOES NOT MOVE, and shrinking the seal is exactly
  what could have moved it.** The three labels' arithmetic is measured from the
  seal's DESIGN size, so `DESIGN_SEAL` and `DESIGN_PAIR_SCALE` are kept beside
  the new `MARK_SIZE` for that arithmetic alone. Checked after the change: 210,
  as before.
- **The seal's frames are baked at 174px for an 87px draw**
  (`DRAWN` in `scripts/build-seal-frames.mjs`), so at 30 the browser downscales
  them 2.9x and the red filigree softens. Accepted rather than re-baked: that
  constant is shared with about/privacy/terms and all 235 cigarette pages,
  which still draw at 87, so a second size means a second 179-frame set.

**The landing page has since moved off the design in five places, all the
owner's asks, all in `lib/landing.ts` and none in the artwork
build:** TEST YOUR LUCK is no longer placed (the part is still cut, so it is
one line to restore); **OFFERS, My Saved and RECOMMENDED are no longer placed
either (2026-09-16), having moved into the logo menu — above**; **the seal and
the sigil pair are drawn at the plus button's 30px with a count in the outline
(2026-09-17) and stand on the plus's line under the row rather than in the top
right (2026-09-19) — above**; the sigil and the square keep 5px between them
as drawn, which the scale takes to 3;
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

**SINCE 2026-09-20 THE BOX ON THE SPLASH IS ONE LONG ROW AND THE FLOW IS PHONE
FIRST — see "THE LOGIN BOX IS ONE LONG ROW" below, which supersedes what this
section says about the splash's own box.** What follows still describes
`splashAuthAction`, which is still in `app/actions.ts` and which **nothing on
the splash calls any more**: it is the email-and-password-with-Google-once flow,
kept until the owner says the phone flow is the one that stays. It is a public
endpoint while it is there, but it can do nothing `/login` cannot. `/login` and
`/register` are untouched and still work the old way, Google button included.

**EMAIL AND PASSWORD, WITH GOOGLE USED ONCE** (the flow before 2026-09-20).
`splashAuthAction` decides in this order:

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

## THE LOGIN BOX IS ONE LONG ROW
The owner's 2026-09-20 rebuild, in their words: "instead of a box with 3 rows I
want to change the login box to a rectangle red outline the height of the
character logo on the landing page with the length of 3 of the current outline
boxes on the login page. in that rectangle outline I want there to be only the
perpedicular left dashed lines with the same margins it currently has with text
that will alternate and a sigil which left edge should line up with where the
next instance of typed text will be. As the user types each letter should create
a piece of the dashed lines underneath the newly typed letter that is the same
length as the letter's width."

`lib/loginBox.ts` (every number, and which measurement it came from),
`lib/loginInk.ts` (the word), `lib/loginEmerge.ts` (the rectangle arriving),
`components/splash/SplashLoginRow.tsx` (the row), `SplashLogin.tsx` (the
sequence), `app/loginActions.ts` + `lib/loginState.ts` (the server).

- **430 x 87 REAL PX, AND WHY BOTH ARE REAL.** The height is the landing page's
  遠東 logo (`lib/landing-geometry.json`, 40 x 87), which is a real-CSS-px mark
  under the margin rule. The width is three of the old box — and the old box
  scaled with the frame (0.336 of it), so "three of them" only names a number
  once a viewport is named. The reference is **1920x947**, which is already this
  repo's desktop reference (`/dev/desktop`): there the frame is 426.15 and the
  box 143.186, so three is 429.56 → 430. Held fixed rather than as 3x
  whatever-the-box-is-now, because that is the site's own rule and the only
  reading under which the rectangle keeps one proportion. A window too narrow
  takes what there is less 12px a side (`loginBoxRect`).
  **`coverRect` in `lib/splashFrames.ts` is a CONTAIN fit despite its name**
  (`Math.min`), which is why the frame is only 426px wide on a 1920 screen and
  `edge.webp` tiles the rest.
- **THE ROW IS ONE ROW OF THE OLD BOX**, scaled off `SPLASH_GEOM.parts.email`:
  the left margin is the old 0.100 held as the absolute 14.32px it was, not as a
  tenth of a box three times as wide.
- **EVERYTHING INSIDE IS PLACED FROM THE RECTANGLE'S OUTER CORNER, VIA
  `.login-row-stage`.** An absolutely placed child of a bordered box is
  positioned from its PADDING edge, so without the stage (`inset: -5px`) every
  mark sat 5px in and 5px down: measured, the rule landed at 19.31 for its 14.32
  and the black outline stood a clear 5px inside the red instead of on its inner
  edge. **It is the shelf's `inside()` trap a second time.**
- **THE VERTICAL DASHED RULE RUNS THE ROW'S HEIGHT, WITH ONE MARGIN TO THE BLACK
  OUTLINE ON ALL THREE SIDES** (the owner's "extend the vertical dashed line so
  the top and bottom margins match the left margins", then "make sure the top
  and bottom … both have the same margins with the black outline"). Measured on
  the page: **7.31 / 7.33 / 7.31**. It is EXTENDED, not stretched — the drawn
  tile (`blackbox.webp`, sprite rows 63..93 of a 63..94 window, ink edge to edge
  so a dash meets a dash at every join) is repeated, because a dashed line made
  longer gains dashes rather than longer dashes. The span wants 5.66 tiles and a
  partial one is cut mid-dash, so **six are used, each squeezed 5.6% along its
  own length** (`ruleSqueeze`) — the same anisotropic squeeze the search bar
  already gives this sprite.
- **ONE TYPE SIZE FOR EVERY WORD, CENTRED** (the owner's "revert the phone # text
  to the original size just center it on the vertical axis and use that same
  text size for each new text element"). 13.20px: PHONE #'s ink matched to the
  drawn label band (10.31px over the H's 703 + the P's 78), which is the
  shelf's and the cigarette pages' own way of setting type against a drawing.
  **What is centred is the FACE's band, not any one word's** — the I's 781 over
  the P's 78 — so the baseline does not move between a prompt with a descender
  and one without, and a prompt can become an answer in the same place without
  the line jumping. `fitRow` still shrinks a run too long for the line, but at
  this size that means forty typed characters; no prompt comes near it.
  (For an hour the type was the rule's full height — "make the size of the typed
  characters the same height as the altered vertical dashed line" — and
  VERIFICATION CODE then had to be half the size of PHONE #. The revert is the
  owner's.)
- **EVERY PROMPT STANDS AT 50% AND GOES TO NOTHING AS THE READER ARRIVES** — the
  old box's own idle weight for a label (`SPLASH_FORM.idle.label`). Focus or a
  typed character takes it out (`data-out` on the ink canvas).
- **THE ☁ IS THE TYPE'S HEIGHT, ON THE TYPE'S AXIS, AND IS THE SUBMIT BUTTON.**
  Its height is the row's ink band (11.34) and its width the mark's own 126x60.
  It stands where the next letter will go; while the prompt is still showing,
  the prompt is standing in that very place, so the mark waits one space past
  it (where the old row drew it) and slides back to the first letter's place on
  focus. **It is the word that gives way, never the mark.** It is a masked
  block, the search bar's construction, so going red is one colour changing.
  `.login-row-sigil-hit` is in all three pressable lists and has a focus ring.
- **THE DASHED LINE IS MADE BY THE TYPING.** One piece per letter, cut to that
  letter's INK (`actualBoundingBoxLeft/Right`), not its advance — pieces cut to
  the advance meet and draw one continuous rule; the gaps ARE the side bearings.
  What is inherited from the drawing is the line's weight (sprite rows 96..100 →
  1.665px) and its 0.76px gap under the type. A password measures its bullets.
- **THE WORD IS WRITTEN BY TENDRILS OUT OF THE BLACK OUTLINE, GENERATED IN THE
  BROWSER** ("have the ink of the Phone # text grow back into a second rectangle
  outline on the inner edge of the red one this one in black. Use the tendril
  animation to regrow the black outline into the new text for the row").
  **`scripts/lib/ink-growth.mjs` is pure JS but for one `Buffer` in
  `Ink.rgba()`**, so `lib/loginInk.ts` imports it directly (`allowJs` is on;
  TypeScript reads `id = null` as the type `null`, hence one named cast). Not
  baked, for two reasons: these words are TYPE, so they can be rastered where
  they are shown, and five networks at the mountain's density would be
  megabytes on the first page of the site. The channels are stroked with the
  canvas's own round-capped lines rather than through `Ink`'s coverage buffer —
  the same picture at this size, 0.1ms a frame against 80.
  - **Two phases, the dots menu's**: 0..0.74 the tendrils write the word,
    0.74..1 they withdraw into the outline and the word stays. A new prompt is
    the old one's run backwards at 2x, then the new one's forwards. Measured:
    ink rises to 8910 px at the apex and rests at 7354, the word alone.
  - **THE FRONT KEEPS GOING AFTER THE TRUNK HAS STOPPED** (`maxT`). A pixel's
    arrival is its arc along the writer PLUS how far off it sits PLUS noise, so
    the furthest is always past the channel's end; paced by the trunk alone, the
    first cut showed a horizontal BAND of each letter and nothing else.
  - **Nothing is written until the box is `live`.** The row is mounted for the
    whole four seconds so the rectangle can come up with everything else; a run
    started at mount is over before the reader can see the box.
  - It waits on `document.fonts.ready` and throws its cache away, because a
    canvas asked for a face it has not got draws the fallback and keeps it.
- **THE RECTANGLE COMES OUT OF THE SEAL, IT DOES NOT FADE IN** ("have the black
  of the original seal logo flow into the black outline in the login box as well
  as the red into the outline as well. in general incorperate the rectangle's
  emergence more organically into the animation"). **THE SOURCE ALREADY DOES
  THIS FOR ITS SQUARE, and measuring it is what this is built on**: the seal's
  own black is 6002 px at f20, 115 at f29 and exactly 0 at f30, and at f30 all
  2532 black pixels left inside that square lie within 6px of its border. The
  logo's black flows into a black box outline; that outline then fades (447 at
  f50) while a red one rises with the cloud field. So the rectangle IS that box,
  carried on — `EMERGE` in `lib/loginEmerge.ts`, as fractions of the run:
  - **0.28–0.34 the handover**: `boxfill.webp` erases the baked square and an
    identical one is drawn in its place, so nothing is seen to happen.
  - **0.34–0.52 the travel**: the paper and its black edge move to the
    rectangle's footprint, the edge thinning from the square's measured 4px to
    the row's 2, with the seal's filigree running ahead of each side.
  - **0.52–0.88 the red**: the outer rule fills outward from the middle of each
    side, which is where the seal's red still is at that point.
  - **It is drawn LAST in `paint()`, above the vignette**, because the row is a
    DOM layer over the canvas and the wash does not reach it; under the wash the
    handover would be a change of contrast. The row's own border and paper wait
    on `[data-emerged]` (paint() writes it, as it writes the ink layer's
    opacity) and take over in one frame — **3 pixels of 48,150 differ across it,
    the worst by 28 of 765**. Both sides are the same flat rectangle on whole
    pixels, which is why this handover is safe where raster-for-vector ones here
    have not been.
  - **A GENERATED NETWORK HAS TO BE DRAWN ON ONE CLOCK.** Drawing every channel
    to the same FRACTION of its own length puts a child's stub 200px ahead of a
    trunk that has gone 20, because a child is placed at its arc along its
    parent; it came out as two dashed lines running off both sides of the box.
    Normalise `t0`/`dur` and read each front off them.
  - **Every run goes the way its edge is going.** The two ends travel SIDEWAYS,
    so their ink runs horizontally out in front of them; rotated to run down the
    sides it shot 143px out of an 87px box.
- **THE PATCH IS LAID DOWN AT THE FIELD'S OWN STRENGTH** ("make the square that
  you are filling with the background pattern the same opacity as the pattern
  around it"). `boxfill.webp` is cut from the LAST frame, where the cloud field
  is at full, so drawn as it was it put a panel of finished pattern into a field
  still coming up. The frames' own ramp is `0.12 + 0.88 * p^0.7`
  (`build-splash-frames.mjs`; in the middle of the picture `sealFade` is the
  larger term only before p = 0.28, which is before the patch starts), so the
  ink goes down at exactly that — over a white pass at the patch's own alpha,
  which is what does the erasing. **That expression is now in two places**
  (the bake and `paint()`); change one and change the other.
  **edge.webp could not be the patch**: it is the same picture at 900 wide with
  sharpen 0.4, and scaled back it carries a visibly different line weight (mean
  |diff| 32 of 255 against f100 outside the box altogether).
- **THE FLOW**: PHONE # → VERIFICATION CODE → (EMAIL → VERIFICATION CODE, only
  for a number nobody has an account on) → PASSWORD. `loginStepAction`:
  - **The server decides which section is live.** The step the box sends is a
    hint and is checked against the attempt's own row; a mismatch answers with
    the real one. A server action is a public endpoint, and a box that could
    name its own step could name `password` first.
  - **Nothing secret is stored.** Supabase Auth bcrypts the password and issues
    and checks the codes; `login_attempts` records where a reader has got to,
    how many codes went out and how many tries failed. A code in an application
    table is a password in an application table with a shorter life.
  - **A RETURNING reader is signed straight back out after their code**, and
    gets in only on `signInWithPassword({ phone, password })` — leaving the
    session standing while the box asks for a password would make the password
    a formality. **A NEW reader keeps the session**, because the address and
    the password are written onto the account with `updateUser`; an abandoned
    attempt leaves a phone-only account, which migration 0004's name fallback
    already handles. The address is verified with `verifyOtp({ type:
    'email_change' })`.
  - "If the account is new accept any submission": **there is deliberately no
    length rule on a new password.**
  - A failure flashes the rectangle `#FF0000` for 500ms and empties it; a code
    section also sends a fresh code, up to three.
- **THREE FAILURES OF ONE SECTION SHUT THE SITE FOR HALF AN HOUR**, and **the
  database stops the login while a cookie stops the browsing — two jobs.**
  `login_blocks` is keyed on the attempt's token AND on the phone number or
  address the codes were going to, so clearing cookies buys a fresh browser and
  the same locked-out number. `fe_blocked` (httpOnly, holds the epoch ms the
  block lifts) is what `app/layout.tsx` reads to draw the all-red TRY AGAIN IN
  30 MINUTES page over everything, with no database round trip on a reader who
  is not blocked. **Not keyed on IP**: a carrier NAT puts a town behind one
  address. **Not middleware**, because this project has none (Known gaps).
  **The cost: every route is dynamic now** — the root layout reads cookies. The
  artwork pages are the only ones that actually changes.
  The handle is a random 256-bit token in an httpOnly cookie (`fe_login`); it IS
  the secret, so nothing is signed and no new app secret was invented.
- **`LOGIN_BLOCK_COOKIE` lives in `lib/loginState.ts`, not in the action file**:
  a `'use server'` module may only export async functions (the gotcha below).

**The top row WAS the EMAIL row again** (before the rebuild above; kept because
the assets it describes are all still in the tree). It was EMAIL, the owner supplied PHONE #
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

**SOURCE ORDER ONLY SETTLES A TIE, SO A CONTROL THAT SETS ITS OWN CURSOR BY
CLASS MUST BE IN THAT LIST BY CLASS** (the owner's 2026-09-19 "make the hover
cursor the white fill cloud"). `button` is 0,0,1; `.cig-reset { cursor:
pointer }` is 0,1,0 and beats it from anywhere in the file. That is how reset,
the plus, confirm, all 81 tags, the cigarette page's plus and the shelf's
bookmark came to show the operating system's hand while everything round them
showed the white cloud — they were reached only by the bare `button`. **A new
pressable with `cursor: pointer` in its own rule goes in BOTH lists** (the
hover one and the `:active` one under it) and in the touch-callout list, or it
does the same; an inline `cursor` in a component beats all of it, so there are
none (`ShelfSharing`'s was removed). To check a page, read the COMPUTED cursor
of every `button, a[href], [role=button]` in the console — a miss says
`pointer` where the rest say `sigil-cursor-press`. The one deliberate
exception added with this: reset and confirm are `disabled` while a spin runs,
and keep the resting black cloud for those seconds (`.cig-reset:disabled`,
after both lists).

`:disabled` is deliberately NOT in that rule. `.btn:disabled` keeps `not-allowed` at
a specificity it cannot reach, which is correct — a disabled control is exactly
the thing that is not pressable. `grab`/`grabbing` on the cigarette row and `text`
in the fields stay for the same reason: they say what the pointer can DO there,
which neither cloud can.

## THE SHELF IS A VERTICAL WHEEL ON A RED PAGE (2026-09-21)
The seal leads to `/shelf`. **Three whole layouts have been and gone here** —
do not trust a note elsewhere in this file that describes one of the first
two. First one pack to a line with a fixed-point solver landing each row's end
on the $ sign (`lib/shelfPage.ts`, `ShelfStage.tsx`, both deleted;
`scripts/build-shelf.mjs` and `lib/shelf-geometry.json` are ORPHANED, still in
the tree and read by nothing). Then a grid of cards, five to a row, each card
four outlined boxes round a pack. Now a wheel.

`components/ShelfWheel.tsx`, `ShelfWheelControls.tsx`, `lib/shelfWheel.ts`;
`lib/shelfGrid.ts` keeps what outlived the grid — the page's margin, the pack
rule, the caret's sprite window and the amount's arithmetic.

**EVERY PACK IS THE SAME WIDTH, NOT THE SAME HEIGHT** (the owner's "make all
the packs the same width not the same height[,] scale the wheel and the packs
to adjust"). That is the opposite of everywhere else packs are drawn here —
the landing row and the grid that stood on this page both stand them at one
HEIGHT — and it is what makes this wheel carry an ARRAY of positions rather
than one pitch, which is the landing row's arithmetic arrived at from the
other side. The marks are all drawn 92 units tall and 40..108 wide, so at one
width their heights run 0.85 to 2.30 of it across the catalogue.

**THE HALF-REVEALED RULE CANNOT HOLD FOR EVERY PACK ANY MORE, and that is
arithmetic rather than a decision.** With pack i centred, the one below is
exactly half revealed when

      H/2 = P_i/2 + 2r + G + P_j/2

so `P_i + P_j` has to be the same for EVERY adjacent pair — true only if
every pack is the same height, which is the thing that has just stopped being
true. So `wheelWidth` sets the width so the rule holds exactly for a pack of
the shelf's MEAN height; a taller one then shows a little under half and a
shorter one a little over. **Measured over the fixture's six at 1920x947:
43.7% to 57.8%, mean 50.2%** — where it was 50.0% everywhere while the
heights were equal. Two clamps, both of which only shrink it: the tallest
pack must fit the screen with a margin top and bottom, and the width must
leave room for the number square off the pack's right edge.

With H the viewport's height, r the pack's rule (5px, its own number — the
controls' 2px is separate) and G the gap. **G IS NOT THE GRID'S 35**, and that is the owner's follow-up:
"scale the packs down to match the original margin constraints between them
while keeping the buttons equidistant". The three controls stand in that gap,
and at 35 they had 5.95px of air either side — which is not a margin, it is
what was left over. So the MARGIN is the constant (`WHEEL_MARGIN`, the
drawing's own 35) and the gap falls out of it as margin + buttons + margin =
93.1. The PACK takes the difference. The buttons stay equidistant by
construction: one margin above them, one below.

Measured, stepping through all six packs at 1920x947: every one the same
218.8px wide with heights 335..403, every one resting dead centre on 473.5,
the margins exactly 35.00 under the pack and 35.00 off its right at every
stop, and the gap 93.13 throughout.

**THE PACK'S RULE IS 5, WHITE, AND ANSWERS TO NOTHING BUT ITSELF** (the
owner's "make the black outlines around the cig images 5px", then "make them
white"). It was 5, went to `CARD.rule` for an afternoon when the ask was "the
same thickness as the outlines above the image" — the four red boxes that
stood over a card — and those boxes went with the grid. The controls' own 2px
is a separate number. **Half strength went with the black**: it was the
drawing's "low opacity black outline", and white at 50% over red is pink.

**IT IS THE ROW'S MOTION, NOT THE ROW'S CODE.** `WHEEL_MOTION` imports the
brake, the fling cap, the settle and the 8fps beat straight from
`lib/cigRow.ts`, so the two feel the same; the tick is written again because
`CigScroller` is 1834 lines of which about half is the landing page's own
furniture — three menus, the spin, the search, `layoutMenu`'s 180 lines of
horizontal placement — and none of it has a vertical meaning. **The debt is
real and is stated in the file: the two ticks are two places now.**
- **Vertically the pitch is ONE NUMBER.** A pack's along-axis extent is its
  WIDTH horizontally, which runs 40..108, so the row needs an array of
  positions; vertically it is its HEIGHT, and every pack is drawn the same
  height. Half of `cigLayout`'s reason to exist disappears when the axis turns.
- **THREE OF THE ROW'S FOUR REST BUGS ARE REPRODUCED AS FIXES** rather than
  rediscovered: a resize re-centres the SELECTED pack (not whichever is
  nearest the new middle), the stop test asks the rule itself and the last
  half pixel is snapped, and a pointer released off the wheel ends the drag,
  heard from the window. The fourth — measuring before a zoom applied —
  cannot happen here, because this wheel has no zoom.
- **A SLOT IS ONE PITCH TALL WITH ITS PACK IN THE MIDDLE**, so an offset of
  zero has to put that middle on the screen's middle: `home = mid - pitch/2`.
  Without that half-pitch the wheel rests with the pack a quarter-screen high
  and nothing ever reads as selected. It was written that way first.
- **THE LIST IS REPEATED UNTIL A LAP IS LONGER THAN THE SCREEN**
  (`wheelCopies`). The loop is modular, and a lap shorter than the screen puts
  the same pack at the top and the bottom at once — which a shelf of two would
  do. A shelf of one is the case the arithmetic cannot save, and that is
  honest: there is only one.
- **ONE NOTCH, ONE PACK** (the owner's "make each scroll of a mouse wheel
  change the selected pack by 1"). The wheel used to push the offset by the
  raw delta and let the glide and the settle find a pack; it STEPS now, and
  the seek carries it. An adversarial pass over that change confirmed
  thirteen defects, and they are the notes worth keeping:
  - **THE OFFSET WAS NEVER WRAPPED, AND THE SHELF WENT EMPTY.** `compute`
    only draws laps -1..n round the current offset and nothing reduced the
    offset itself, so scrolling one way for about two seconds walked it past
    every lap drawn: no packs, no selection. `wrap()` keeps it inside one
    lap and shifts anything holding an absolute position — an in-flight
    seek, a drag's anchor — by the same amount in the same breath. **This
    predates the stepping and would have bitten a drag too.**
  - **`Math.sign(0)` IS 0, AND THAT WIPED THE BANK.** Comparing signs made
    any event with no vertical travel — a horizontal swipe, a tilt wheel,
    the zero-delta events Chrome brackets a trackpad gesture with — read as
    a direction reversal. Measured: a shallow diagonal swipe of 160px of
    real travel selected nothing at all. An event with no vertical delta is
    not a reversal and is not travel; it is ignored.
  - **A CONTROL INSIDE THE WHEEL GETS THE EVENT FIRST AND KEEPS IT.** The
    quantity stripes are rendered inside the selected slot and cancel their
    own wheel events, and both listeners are on the bubble path — so rolling
    a stripe to pick an amount ALSO stepped the shelf, which unmounts the
    menu mid-gesture and loses the amount. `if (e.defaultPrevented) return`.
  - **A LINE OR A PAGE IS ALREADY ONE NOTCH.** Firefox reports lines, and
    how many lines a notch is comes from the reader's own system setting —
    three by default on Windows, but one, six or a page are all choosable.
    A guessed line height got one-notch-one-pack right only at the default,
    so those modes step once per event and the bank is not involved.
  - **THE BANK IS ZEROED ON A STEP, NOT DRAINED**, and that is deliberate:
    40 is a test for "a notch happened", not a quantum of travel. Drained, a
    100px notch would leave 60 behind and step two or three packs — the very
    thing the owner asked to be removed. A reviewer called the zeroing a
    defect; it is the requirement.
  - **A HAND ON THE WHEEL OUTRANKS WHAT THE WHEEL WAS DOING.** A press now
    clears the seek a notch left in flight and the banked travel with it.
  - **A RESIZE STOPS THE TICK IT IS INVALIDATING**, which it did not: the
    tick is a closure over the layout that has just been replaced and it
    reschedules itself.
  - The first tick of a run comes at 16ms rather than a whole 125ms beat,
    because a notch's seek lands in one tick — so a notch used to be an
    eighth of a second of nothing and then the whole move, with the controls
    away for 250ms of it.
- **THE OFF-CENTRE PACKS ARE DRAWN HALF SIZE, WITH A QUARTER SHOWING** (the
  owner's "scale the bottom and top packs down so only 1/4 of them is
  visible while the middle one remains the same"). **The two halves of that
  ask pull against each other and it is worth knowing why**: with the gap
  where it was, a QUARTER-reveal needs the neighbours BIGGER, not smaller —
  what is on screen below the middle pack is fixed, so filling it with a
  quarter of something makes that something four times it. Showing LESS of a
  pack means moving it further away. Asked, the owner chose half-size
  neighbours, so `WHEEL_FAR_SCALE` is 0.5 and the step solves to
  `H/2 + k.P/4` — which puts the wheel back on a UNIFORM pitch and so puts
  the settle, the arrow keys and the seek back on one number. The scale is
  smooth in the distance from the middle, so a pack grows into the centre
  rather than popping. Measured over four stops: 22.4% to 23.8%, against 25%
  for a pack of the mean height.
- **A PRESS MEANT FOR A CONTROL IS NOT A PRESS ON THE WHEEL**, and taking it
  as one CLOSED THE QUANTITY MENU THE MOMENT IT OPENED — the menu's trigger
  cancels its own pointerdown, but the press also reached the stage, and the
  matching pointerup ran `endDrag` -> `run()` -> `setResting(false)`, which
  unmounts the controls, and the menu is one of them. `e.defaultPrevented`
  on the way in, and `endDrag` returns without running the tick for a press
  that never became a drag.
- **THE TEXT EDITOR'S SQUARE CARRIES BOTH MARKS OF A LOGIN ROW**: the
  vertical dashed rule at the margin it kept when this was a bar, and the
  horizontal one the typed letters sit on, which keeps that same margin off
  the box on the left, the right and the foot. Same sprite, same scale, so
  the dashes match. Measured: 7.08 left, 7.07 right. **They are ALIGNED ON
  THEIR BOTTOM EDGES** (the owner's ask), so the caret stands on the rule
  rather than floating in the middle of the box — which is how the two marks
  meet in a row of the login box. Measured: both at 723.08.
- **A PACK WITH NO AMOUNT SET READS 0**, not an empty box: the shelf holds
  it, so the honest answer to "how many" is none rather than nothing.
- **THE CONTROLS HANG OFF THE PACK, NOT THE SLOT** (`.shelf-wheel-stand`). A
  slot is the full width of the page — it has to be, to centre a pack of any
  width — so a control placed at its 100% lands at the page's edge. The number
  square went off the right of a 1920 screen before the stand existed.

**WHAT STANDS UNDER THE PACK, AND ONLY ONCE IT HAS STOPPED** (the owner's
"after it fully stops spinning" — the tick's own rest, not a transition):
- **IT IS THE LANDING PAGE'S TRIANGLE AFTER ALL** (the owner's 2026-09-21
  "move the star button down and aligned with the middle of the cig image so
  it is the same as the triangle of buttons on the landing page"). Its glass
  and dots share an upper line with the plus centred below them; here the
  text editor and the favourite are above and the clouds below, centred on
  the pack's own axis. **It could not be done when the three first went in**
  — two lines of these squares cannot live in a 35px gap, which is what the
  gap was then, and the owner picked a row instead. Half-size neighbours
  pushed the packs apart and there is room now.
  - **THE OUTER TWO DID NOT MOVE.** They stand where the first and third of
    the row stood, so their gap is the row's three slots less their own
    width — 3 x the button.
  - **THE STAR'S LINE IS THE LANDING PAGE'S RULE WITH THIS PAGE'S EDGES**:
    it centres its plus between the red frame's foot and the page's foot,
    and this centres the clouds between the pack's outline foot and the top
    of the pack half-showing below. Worked out from the MODEL at rest, never
    read off a moving wheel — the row's own `cigTagsRight` failure, where an
    edge read live swung 860 -> 304 -> 794 through one throw. The pack below
    is taken as the shelf's MEAN so the line does not jog as the wheel
    passes a tall pack and then a short one.
  - **THE EDITOR IS LEFT AND THE FAVOURITE RIGHT**, the owner's swap.
    Measured: centres at 913.8 and 1006.2 about a pack centred on 960, and
    the star at exactly 960.
- **ONE MARGIN DOES TWO JOBS.** The air that centres a button in the gap
  ((35 - 23.1)/2 = 5.95) is also the distance the number square stands off the
  pack's right edge — the owner's "an equal margin between its left edge and
  the pack outline to the top edge of the grouping of the other 3 buttons and
  the bottom edge of the pack outline". The number is centred on the pack
  (asked).
- **THE FAVOURITE STARTS PRESSED**, because every pack on this wheel is
  already on the shelf.
- **THE TEXT EDITOR IS A SQUARE BUTTON AND NOTHING ELSE YET.** The owner:
  "the text editor square will act as a button to open a larger text editor
  but i will give instructions on that construction after u are done". It
  carries the login box's own dashed rule at the margin it kept when this was
  a bar. **The typed run and the blinking caret the bar had are gone with
  it** — they belong to the larger editor, which is the next piece of work.
- The quantity wheels still open out of the number square, at the pack
  outline's width, held to the room left on the page.

**BLACK PAGE, WHITE CONTROLS** ("change the page background to red and the
outline buttons and all their elements to white … make the new hover an
inversion of colors to black fill with white as the color of the elements
inside the box and no outline" — then, the same day, "make the background
black").
- **A CONTROL AT REST IS ITS MARK ALONE** (the owner's 2026-09-21: "make the
  things inside the outline buttons red and remove the outlines until user
  hover or click and make them red as well but with 50% opacity on hover and
  100% on click"). Red marks on the black ground, no outline until the
  pointer arrives; then the line at half strength, and at full while it is
  pressed or has the keyboard. This replaced the black-fill inversion, which
  had become the same colour as the page.
  - **THE LINE IS KEPT IN THE BOX AND NOT DRAWN** — `solid transparent`, not
    `none` — so a control is the same size whether its outline shows or not
    and nothing shifts under the pointer.
  - **THE OPACITY IS IN THE BORDER'S OWN COLOUR, never on the element**
    ("the inside parts opacity should stay consistent"). An `opacity` on the
    button would take the mark down with the line; an alpha in the border
    takes only the line.
  - **The mountain button was NOT included.** The owner named it explicitly
    when the controls last changed colour ("including the mountain button")
    and did not this time, and its ink is baked rather than CSS — so it is
    still white. Flagged.
- The red the page used to be is the artwork's own `#FF0000`. **Not
  `--negative`** — that token is warm grey and is never an error colour, per
  the spec.
- `color-scheme` is `dark` now rather than `light`: the page paints its own
  dark ground, and saying so is what stops a browser or OS doing auto-dark
  from remapping it. The declaration exists for that reason on the artwork
  pages too, where it says `light` for the same reason.
- **`.shelf` IS `overflow: hidden` NOW.** The wheel is the scrolling; a scroll
  container would fight its own wheel handler and put a grey bar down the red
  edge.
- **THE BORROWED QUANTITY WHEELS ARE OVERRIDDEN, NEVER EDITED.**
  `CigQuantity`'s own scheme is a red panel with white stripes and black type,
  which is invisible on a red page — but those rules are shared with all 235
  cigarette pages, so the shelf restates them under `.shelf` and gives them
  the same inversion: black ground, white rule, white marks.
- **THE MOUNTAIN BUTTON'S OWN HOVER IS STILL THE ANIMATION**, not a fill. It
  has never had a colour hover — its answer to a pointer is to unfold — and
  the inversion is applied to the page's own outlined controls.
- **SIXTEEN PACKS SHOW A WHITE PAPER FRINGE ON RED.** Every one of the 247
  marks is a fully opaque photograph, and the loose cut-outs this file already
  documents (the Lotus / Nanjing / Taishan / Huanghelou block) carry a margin
  of the photograph's own white paper. On white that was invisible; on red it
  is a white border on about 6% of the shelf. It is a crop question
  (`npm run audit:cigs`, `HAND_CROP`), not a CSS one.

**THE MOUNTAIN BUTTON AND ITS MENU ARE DRAWN WHITE, AND THAT IS ONE VALUE.**
- `INK` in `LogoMenu` is a per-menu table beside `LATCH` and `PLAY_RATE`, for
  the same reason: it is a judgement about one menu. The frames are baked with
  RGB zeroed and everything in alpha, so the tint is `source-in` — it keeps
  the destination's alpha and replaces its colour, so a 50%-covered edge stays
  50% covered and simply becomes white.
- **THE TINT IS A WRAPPER, NOT A LINE AT THE FOOT OF `paint`.** That body
  returns early in four places and `hoverBoxRef` is null for every frame of
  the run, so a tint inside it would be skipped on almost every paint.
- **THE DIM IS NOW `destination-out`, and had to be.** It used to clear the
  word's rect and redraw the frame into it at half alpha — the same number
  (`da x a` either way) but it NAMES A COLOUR: it re-introduces the baked
  black. Tinted first, every hovered word would have gone black on a red page.
  `destination-out` only ever removes alpha, so it cannot fight a tint
  whatever order the two run in. `CigDots` already did it this way.
- **THE RESTING STILL IS A MASKED `<span>` IN BOTH MENUS NOW, not an `<img>`.**
  A mask over a block of colour reproduces an alpha-only map in any colour,
  where an `<img>` can only be the black it was baked as. Both sides read the
  same `INK` value, and that is the point: the handover between the page's
  copy and the canvas's is invisible ONLY because they are the same pixels,
  and recolouring them by two different mechanisms is exactly the class of
  mismatch the 遠東 logo was reported for. **Keep it a sibling of the canvas,
  not a child of the button** — the old reason still stands.
- Verified: the shelf's menu ink reads 255,255,255 over 5,519 opaque px and
  the landing page's 0,0,0 over 4,826 — one page white, the other untouched.

**THE SHELF'S MENU IS THE LANDING PAGE'S WITH A FOURTH WORD** (the owner's
2026-09-21). `components/ShelfMenu.tsx`, `lib/shelfmenu-geometry.json`,
`public/shelfmenu/`, and `LogoMenu menu="shelf"`.
- **ONE SCRIPT BAKES BOTH MENUS**, and `npm run build:growmenu` now runs it
  twice — `node scripts/build-grow-menu.mjs` then the same with `shelf`.
  Everything but the word list is shared: the mark, the sky, the drain, the
  network's rules and every proof. **Running it twice rather than looping
  once** keeps the diff to a table at the top; the second gif read costs 1.5s,
  which is the whole price. Two scripts would have duplicated ~500 lines, and
  the dots menu already shows what that costs.
- **THE LANDING PAGE MUST COME BACK BYTE-IDENTICAL, and that is the test.**
  All 142 frames, `badge.webp` and `growmenu-geometry.json` were hashed before
  the refactor and matched after. The word layout is computed BEFORE the
  network's rng is seeded, so a fourth word cannot move the first three —
  the shelf bake lays about/privacy/terms on 89.5 / 207.5 / 369.5, exactly
  where the grow bake does.
- **HOME IS NOT IN THE OWNER'S GIF AND CANNOT BE**: its six words carry no
  `h` anywhere. Same wall the BAR menu hit, same answer —
  `scripts/assets/menu-home-label.png`, the word set in the owner's face and
  rendered in Chrome (librsvg, which sharp rasterises SVG with, ignores an
  @font-face even with the font inlined). It is brought in by the SAME rule
  the gif's words are sized by: `lineBands` finds its x-height and it is
  scaled so that band is `X_STAR`, the reset button's own. Measured, its
  x-height is 14 label px → 8.21 page px, i.e. exactly 15px type — so it is
  the same size of the same face as its neighbours because it is measured
  against the same thing, not because a factor was chosen.
  - **The png is a COVERAGE map** (white ink on black) and everything
    downstream works in ink over white, so it is inverted on the way in.
    Drawn un-inverted the whole 110px square becomes ink and the build stops
    on its stray-pixel count, which is the check doing its job.
  - **Its box is the whole INK, not the x-height band.** The h's ascender
    stands above the band, and a box cut to the band leaves it outside the
    words' boxes, where it counts as stray and the build stops.
  - It is upscaled 1.17x where the gif's three are downscaled 4.15x, and the
    weights still agree: median stroke 4 / 4 / 5 / **5** device px, means
    5.53 / 5.61 / 6.19 / **6.39**. No fresh render was needed.
- **The two share one `badge.webp`, and the build proves it** rather than
  assuming: the still is cut from frame 0, which is the mark alone, and the
  mark is a function of the button's size and the vector with no word in it.
  The shelf bake compares its own cut against the file byte for byte and
  fails if they differ — if they ever do, the two buttons have drifted.
- **`ROW_GAP` stays `inkLeftOf(2) - inkRightOf(1)`** — do NOT make it
  `ITEMS.length`. The owner named that gap ("the last one between the TOS and
  privacy policy"); it is the same number whether the menu carries three
  words or four, and a fourth takes it rather than redefining it. Measured:
  all four gaps 56.3.
- **`--logo-menu-zoom` HAS TO BE MEASURED HERE.** On the landing page
  `CigScroller` publishes it; there is no row on the shelf. **0.7 is not an
  approximation of the landing page's value — it IS that value** at every
  viewport under about 1845px, because the floor binds everywhere below
  that. Above it the landing button grows, and it also moves whenever the
  row settles on a pack of another width, so "the same scale" has no single
  number to copy.
  **It is clamped down on a narrow window, and the fourth word is why**:
  three words reach 363px at 0.7 and fit a 390px phone, four reach 437 and
  do not. **It cannot be a `min()` in CSS** — a zoom is unitless and CSS
  cannot divide a length by a length, so `min(0.7, (100vw - 20px)/610)`
  divides a length by a number and yields a length, which `min()` will not
  mix with 0.7. Hence `ShelfMenu`, a client component whose only job is that
  number; it renders `display: contents` so it is a carrier and nothing else.
- **`.shelf .logo-menu` IS `position: fixed`, and only there.** `.shelf` is
  the scroller (`overflow: auto`) and an absolutely placed child of a scroll
  container travels with the content — a shelf of forty packs would carry
  the button off the top. On the landing page the containing block is
  `.artpage-stage` and fixed would break it. `.shelf` is itself `inset: 0`,
  so the viewport and the page's border are the same box.
- Verified in a real browser at 1920 and 390: the button on 10,10 at
  23.09px (33 x 0.7) and 19.2px (the clamp), four words with HOME last going
  to `/landing`, shut words out of the tab order and the a11y tree and
  taking no pointer, hover unfolds, leaving does not close it, its own
  button runs it back to the mark exactly, HOME wholly on the page at 390,
  and the landing page still three words, still `absolute`, still on 10,10.

**The plus beside the bookmark opens a quantity menu** (`components/CigQuantity.tsx`,
`PLUS`/`QUANTITY_MENU`/`WHEEL` in `lib/cigPages.ts`). **TWO PAGES USE IT AND
ONLY ONE HAS A PLUS**: the cigarette page, where the artwork draws the button,
and the shelf card, where the amount box is the button and the component's own
trigger is laid invisibly over it (see the shelf above). It is shared by 235
pages, so change it with care — the shelf deliberately took none. The plus box is the
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
0. **MIGRATION `0006_big_shares.sql` IS WRITTEN AND NOT YET APPLIED.** It adds
   `profiles.big_shares`, the number the landing page draws in the outline beside the
   sigil. `npm run verify:db` passes with it (46/46, five of them new and covering the
   counter end to end through the real `createShare`), but the shared Supabase project does
   not have the column yet — **the author applies it once, in the SQL Editor**, per the team
   rule. Until then `bigShares()` catches Postgres `42703` ONLY and reads 0, so the landing
   page does not 500 over a number in the corner; every other error still throws. Delete
   that catch once the column is live.
0b. **MIGRATION `0007_login_flow.sql` IS WRITTEN AND NOT YET APPLIED, AND THE
   PHONE FLOW CANNOT RUN UNTIL THREE THINGS ARE SWITCHED ON IN THE SUPABASE
   DASHBOARD.** `npm run verify:db` passes with it (46/46; the table count it
   checks is 10 now). The author applies it once, in the SQL Editor. Then, under
   Authentication → Providers: **Phone ON with Twilio's Account SID, Auth Token
   and Message Service SID** (those go in the dashboard and NOWHERE in this
   repo, which is public); **Email ON with custom SMTP** — the shared mailer is
   capped at a couple an hour and answers `over_email_send_rate_limit` past
   that, which for a verification code is a reader who never gets one; and the
   **"Change Email Address" template must carry `{{ .Token }}`**, or the email
   section sends a link where the box asks for six digits. Until then the box
   draws and animates and every submission says sign-in is switched off.
   **None of the OTP calls has been exercised against a live project** — the
   logic is reviewed, the network is not.
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
8. **The pack shelf has a page now — `/shelf` — and three things on it have
   no data behind them.** `savedPacks()` feeds it and the bookmark there
   both adds and removes, so a saved pack can be seen and taken off. What is
   still hollow: **the worth in the header** (`ShelfPage` takes a `worth`
   prop and the route passes none — `pack_favorites` keys on a pack id and
   `lib/cigs.json` carries no money, so the shelf cannot be totalled);
   **the comment bar**, which types but has nowhere to keep a note (a column
   on `pack_favorites`, so a migration and the owner applying it); and **the
   cloud button**, which opens exactly as asked and is wired to nothing.
   All three are the owner's call, not oversights.
   `/favorites` is still the separate CATALOGUE shelf, through
   `favoritesWithNotes`.
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
  again later it had).
  **IT ALSO MAKES A dt-DRIVEN ANIMATION LOOK LIKE IT IS CHANGING SPEED, which
  cost a round of bug-hunting.** The owner watched the logo menu in the pane and
  reported it "increasing in speed exponentially each time I used it". Nothing
  in the menu accumulates — measured, four consecutive open/close cycles came to
  9.39s each with exactly one rAF callback per frame. What changes is the FRAME
  SUPPLY: the pane delivers rAF in bursts, and measured over six seconds it gave
  five frames — four at 16.7ms and **one gap of 2002ms**. The scrub used to
  clamp `dt` at 64ms (so a backgrounded tab could not return and jump the whole
  animation at once), so a 2002ms gap advanced the animation by 64ms of its own
  time and threw the other 1938 away. The more awake the pane was, the less time
  was thrown away and the faster the same animation appeared to run.
  **THE CLAMP IS GONE FROM `LogoMenu` — the owner asked for the speed without
  the ramp.** Unclamped, a run takes the same wall-clock time whatever the frame
  supply: measured on a virtual clock, 10.32s at a steady 60fps, 10.34s on the
  pane's own pattern (four frames then a 2s stall — 24 frames for the whole
  run), 11.0s on an absurd one. Where frames are scarce it now STEPS instead of
  crawling, which is the honest picture of two seconds having passed. The case
  the clamp was really there for is handled properly instead: a hidden tab gets
  no rAF at all, so `lastTsRef` is reset on `visibilitychange` and the time
  spent away contributes nothing. **Any other rAF loop on this site still has
  its clamp and will still ramp in the pane** — the splash and the seal.
  **Check a speed complaint in a real browser window before touching a rate.**

  All three of these looked like site bugs for an afternoon apiece. Working
  around the pane: to drive an rAF loop there, shim it with a `MessageChannel`
  (which the pane does not throttle), never a timer — and if the thing under
  test is a DURATION, give the shim a virtual clock whose gaps you choose, which
  is the only way to tell a rate apart from a frame supply. To read a
  transition, wait several seconds or read the rule, not the computed value.
  And its scripted pointers have ids the browser never issued, so
  `setPointerCapture` throws for them — stub it on `Element.prototype` for a
  test, and read the guard above.
- **A GENERATED NETWORK'S POINTS CAN BE SHARED BETWEEN CHANNELS, AND BOTH
  BAKES MOVE EVERY POINT ONCE THEY KNOW WHERE THE CANVAS IS.** `linkTips`
  splines between two tips and hands in the tip objects themselves, so the
  link's first point WAS the same object as the end of the channel it joins;
  translating the network then moved it twice and dragged one end of the link
  across the picture. In the dots menu that came out as four long strokes
  running to the canvas edge and being cut off square there, and it was in the
  mountain menu too. Fixed twice over: `spline` copies its first point, and
  `translate` in `scripts/lib/ink-growth.mjs` de-duplicates — use it rather
  than writing the loop again.
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
