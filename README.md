# Far East · 遠東

A cigarette catalogue built to `DESIGN-far-east.md`. **Every score comes from readers — there is
no editorial rating.** Reading is fully open: the catalogue, every review, every rating and every
shared shelf work with no account. An account adds rating, reviewing, and a shelf you can share
with a link.

```bash
npm install
npm run dev          # http://localhost:3000
npm run demo         # optional: three reader accounts with reviews and shelves
```

The catalogue seeds itself from `lib/catalog.json` the first time the database is opened, so
there is no separate setup step. Data lives in `data/far-east.db` (SQLite, gitignored).

## What is here

| Route | Auth | What it does |
|---|---|---|
| `/` | open | Hero, highest-scored lead review, top picks, seal-of-approval winners, reader reviews, newsletter band |
| `/catalog` | open | 32 products, filterable and sortable — see below |
| `/cigarette/[slug]` | open | Full review: hero, verdict card, pros/cons, five sub-scores, spec grid, reader reviews, rating form |
| `/list/[token]` | open | A shelf as it stood when its owner generated the link |
| `/register`, `/login` | open | Account creation with an age confirmation |
| `/favorites` | account | Your shelf — annotate entries, generate or cancel a share link |
| `/account` | account | Stats, your reviews, sharing settings, sign out |

**Sharing is a snapshot.** Generating a link freezes the shelf — the products, your notes and your
own scores — at that moment, and stamps it with a timestamp. Anyone with the link can open it
without an account, and it keeps showing that snapshot however much the live shelf changes
afterwards. Cancelling kills every copy of the link at once; generating again produces a fresh
snapshot at a new address. One live link per person.

**Catalogue filters** — free-text search (matches name, brand, country, summary and the Chinese
name), plus multi-select facets for country, strength, flavour, format and filter type, a max-tar
threshold, and eight sort orders. Every filter lives in the URL, so any view is linkable and the
back button works. Facet chips carry live counts.

## Running it

```bash
npm install
cp .env.example .env.local     # then fill in the three Supabase values
npm run seed                   # upserts the 32-cigarette catalogue
npm run dev                    # http://localhost:3000
npm run demo                   # optional: reader accounts, reviews, shelves
npm run verify:db              # 23 checks against a throwaway Postgres
```

Schema lives in `supabase/migrations/0001_schema.sql`. Deployment is in [DEPLOY.md](DEPLOY.md).

## Stack

Next.js 15 (App Router) · React 19 · Supabase Postgres, queried directly with
[postgres.js](https://github.com/porsager/postgres) · Supabase Auth via `@supabase/ssr` ·
Server Actions for every mutation · no client-side data fetching library, no CSS framework.

Queries are hand-written SQL rather than PostgREST calls: the catalogue needs window
functions, correlated aggregates and multi-facet filtering, which read far better as SQL.
All data access happens in server components and server actions.

## Design system fidelity

Everything in `app/globals.css` is a token from the design file; there are no inline hexes.

- **Cinnabar means judged.** The seal, the score, primary CTAs and inline body links. Nothing else —
  the pack illustrations deliberately use a neutral strength band rather than cinnabar.
- **Scores are never colour-graded.** A 3 and a 10 render in the same cinnabar seal, and
  `criteria-bar` fills cobalt at every value.
- **Red is not an error colour.** Cons markers, failure states and negative notices use
  `--negative` (warm gray).
- **Radius 0 everywhere** except icon buttons and avatars.
- **Two surface modes with per-context defaults.** Dark for the homepage, catalogue, shelves and
  auth; light for review bodies and the methodology page. The toggle in the nav overrides and
  persists, and an inline pre-paint script means the page never flashes the wrong mode.
- **680px article measure** on review bodies and the methodology page regardless of viewport.
- **Seal divider** — cobalt then cinnabar, two bars, under the nav and between editorial bands.
- **`review-card` score seal** overlaps the pack image's bottom-left corner by 16px (8px below 768px).
- **Responsive**: 3-up → 2-up → 1-up card grids, hamburger nav below 768px, hero photography
  crops 3:2 → 4:3 rather than letterboxing, sidebar collapses above the article body.
- The score seal carries an explicit accessible name (`"Far East score: 8 out of 10"`) because the
  "/10" is visually separated from the digit — one of the gaps the design file flagged.

## Product photography

`components/PackShot.tsx` is a stand-in: a flat neutral ground with a consistently framed pack,
where the only thing that varies between products is the band height, which encodes strength.
It renders 1:1 in card grids and 3:2 in review heroes, matching the geometry the design file
specifies, so real photography drops into the same slots without a layout change.

## Tobacco content

The site carries an age confirmation on first visit, a health warning band in the footer of every
page, a prominent warning on each review, and a methodology page explaining that machine-measured
tar and nicotine figures do not describe what anyone actually inhales. Scores describe how well a
product does what it set out to do and nothing more. There are no affiliate links and nothing for
sale.

Catalogue specifications are approximate market-label figures compiled for this build. Verify them
against current packaging before treating any of them as authoritative.
