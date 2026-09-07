-- Far East — schema.
-- Identity lives in Supabase Auth (auth.users); public.profiles carries the
-- app-facing display name and is what every other table references.

-- ---------------------------------------------------------------- profiles --
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  created_at   timestamptz not null default now()
);

-- A profile row is created automatically for every new auth user. display_name
-- comes from the sign-up metadata, falling back to the local part of the email.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
      split_part(new.email, '@', 1)
    )
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -------------------------------------------------------------- catalogue --
-- tar/nicotine/price are double precision rather than numeric on purpose:
-- the driver returns numeric as a string, and these are read as numbers.
create table if not exists public.cigarettes (
  id          bigint generated always as identity primary key,
  slug        text not null unique,
  name        text not null,
  cjk         text,
  brand       text not null,
  country     text not null,
  market      text not null,
  strength    text not null,
  flavour     text not null,
  format      text not null,
  filter_type text not null,
  length_mm   integer not null,
  tar_mg      double precision not null,
  nicotine_mg double precision not null,
  pack_size   integer not null,
  price_usd   double precision not null,
  year        integer not null,
  summary     text not null,
  verdict     text not null,
  pros        jsonb not null,
  cons        jsonb not null
);

-- ---------------------------------------------------------------- reviews --
create table if not exists public.reviews (
  id           bigint generated always as identity primary key,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  cigarette_id bigint not null references public.cigarettes(id) on delete cascade,
  rating       integer not null check (rating between 1 and 10),
  title        text not null default '',
  body         text not null default '',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (user_id, cigarette_id)
);

-- -------------------------------------------------------------- favorites --
create table if not exists public.favorites (
  id           bigint generated always as identity primary key,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  cigarette_id bigint not null references public.cigarettes(id) on delete cascade,
  note         text not null default '',
  created_at   timestamptz not null default now(),
  unique (user_id, cigarette_id)
);

-- ----------------------------------------------------------------- shares --
-- A share is a frozen copy of the shelf at the moment the link was generated.
create table if not exists public.shares (
  id         bigint generated always as identity primary key,
  token      text not null unique,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create table if not exists public.share_items (
  id           bigint generated always as identity primary key,
  share_id     bigint not null references public.shares(id) on delete cascade,
  cigarette_id bigint not null references public.cigarettes(id) on delete cascade,
  note         text not null default '',
  rating       integer,
  review_title text not null default '',
  position     integer not null
);

-- At most one live link per person.
create unique index if not exists shares_one_active
  on public.shares(user_id) where revoked_at is null;
create index if not exists share_items_share_idx on public.share_items(share_id, position);
create index if not exists reviews_cigarette_idx on public.reviews(cigarette_id);
create index if not exists favorites_user_idx    on public.favorites(user_id);

-- ------------------------------------------------------------ subscribers --
create table if not exists public.subscribers (
  email      text primary key,
  created_at timestamptz not null default now()
);

-- -------------------------------------------------------------------- RLS --
-- Supabase exposes every table in `public` through PostgREST using the anon key,
-- so RLS is not optional here. The app never reads through PostgREST — it talks
-- to Postgres directly over a pooled connection, which bypasses RLS — so the
-- only policy needed is public read access to the catalogue. Everything else has
-- RLS on and no policy, which denies all PostgREST access by default.
alter table public.profiles    enable row level security;
alter table public.cigarettes  enable row level security;
alter table public.reviews     enable row level security;
alter table public.favorites   enable row level security;
alter table public.shares      enable row level security;
alter table public.share_items enable row level security;
alter table public.subscribers enable row level security;

drop policy if exists "catalogue is public" on public.cigarettes;
create policy "catalogue is public" on public.cigarettes for select using (true);
