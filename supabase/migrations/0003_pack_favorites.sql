-- A shelf for the packs.
--
-- The bookmark on a cigarette's own page (/packs/<id>) saves it, and the thing
-- it saves is not a catalogue product: the 235 pages are built from the owner's
-- own vectors and keyed by the pack's source filename — 04_ESSE-Change_Strawberry
-- — while public.cigarettes holds 32 placeholder rows from lib/catalog.json.
-- favorites.cigarette_id is a foreign key into that table, so a pack cannot go
-- in it, and putting one there would mean inventing a brand, a country, a tar
-- figure and a verdict for each of the 235. So the packs get their own shelf,
-- keyed by the identity the whole cigarette side of the site already uses.
--
-- pack_id is deliberately NOT a foreign key: the pack list lives in
-- lib/cigs.json and is rebuilt from the owner's image folder, not seeded into
-- the database. It is the page's id rather than the pressed pack's, so the
-- twelve packs that share a name with another (see lib/cigPages.ts) save as
-- the one cigarette they are, not as two.
--
-- When the real catalogue arrives (HANDOFF.md → Known gaps) and these packs
-- become products, this table joins to it on pack_id and can be folded in.
create table if not exists public.pack_favorites (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  pack_id    text not null,
  created_at timestamptz not null default now(),
  unique (user_id, pack_id)
);

create index if not exists pack_favorites_user_idx
  on public.pack_favorites(user_id, created_at desc);

-- RLS on with no policy, like every table but the catalogue: the app reaches
-- Postgres directly as the owner and scopes every query by user_id, and this
-- denies PostgREST — which the browser-visible key can reach — by default.
alter table public.pack_favorites enable row level security;
